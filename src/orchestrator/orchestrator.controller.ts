import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

import { Anthropic } from '@anthropic-ai/sdk';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getSystemPrompt } from 'src/utils/getSystemPrompt';
import { publish } from 'src/lib/sessionHub';
import { db } from 'src/utils/firebase';
import { RUNS } from 'src/lib/runRegistry';
import { StopRunDto } from './dto/stop-run.dto';

type OrchestrateDto = { prompt: string; sessionId: string };

export const TOOLS = [
  {
    name: 'searchFiles',
    description: 'Search for files matching a query.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
        includePattern: {
          type: 'string',
          description: 'Glob pattern to include files.',
          default: '**/*.{js,ts,jsx,tsx}',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'writeFiles',
    description: 'Write content to a file.',
    input_schema: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          description: 'An array of file edits to apply.',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'The path to the file to write.' },
              content: { type: 'string', description: 'The content to write to the file.' },
            },
            required: ['path', 'content'],
          },
        },
      },
      required: ['edits'],
    },
  },
  {
    name: 'viewFiles',
    description: 'View the content of a file.',
    input_schema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          description: 'An array of file paths to view.',
          items: { type: 'string', description: 'The path to the file to view.' },
        },
      },
      required: ['paths'],
    },
  },
  {
    name: 'writePatches',
    description: 'Apply patches to files.',
    input_schema: {
      type: 'object',
      properties: {
        patches: {
          type: 'array',
          description: 'An array of patch objects to apply.',
          items: {
            type: 'object',
            description: 'A patch object containing the file path and the find/replace strings.',
            properties: {
              path: { type: 'string', description: 'The path to the file to patch.' },
              find: { type: 'string', description: 'The regex pattern to find.' },
              replace: { type: 'string', description: 'The replacement string.' },
            },
            required: ['path', 'find', 'replace'],
          },
        },
      },
      required: ['patches'],
    },
  },
];

const APP_ROOT = path.join(process.cwd(), 'myApp');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY! });

/* ───────── helpers ───────── */

const FORBID_WRITE = [
  'server/index.ts',
  'server/routes.ts',
  'server/zip.ts',
  'server/vite.ts',
  'server/backend-server.ts',
  'server/backend-routes.ts',
  'server/backend-entry.ts',
  'node_modules',
  '.env',
  'fly.toml',
  'Dockerfile',
  'package-lock.json',
  '.dockerignore',
  'dist',
  'public/downloads',
];

function assertAllowedWrite(p: string) {
  const lower = p.replace(/^myApp\//, '').toLowerCase();
  for (const bad of FORBID_WRITE) {
    if (lower === bad.toLowerCase()) throw new Error(`Writes to ${bad} are forbidden`);
    if (lower.startsWith(bad.toLowerCase() + '/')) throw new Error(`Writes to ${bad}/… are forbidden`);
  }
}

function searchFiles(query: string, includePattern = '**/*') {
  const matchAll = query.trim() === '*';
  const tokens = query.trim().split(/\s+/);
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexes = matchAll ? [/.*/i] : tokens.map((t) => new RegExp(escapeRegex(t), 'i'));

  const files = glob.sync(includePattern, {
    cwd: APP_ROOT,
    nodir: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'package-lock.json',
      'yarn.lock',
      '**/*.lock',
      'fly.toml',
      'Dockerfile*',
      '.dockerignore',
      '.gitignore',
      'zip.ts',
      ...FORBID_WRITE,
    ],
  });

  return files
    .map((fp) => path.join('myApp', fp))
    .filter((fp) => {
      const base = path.basename(fp);
      if (tokens.some((tok) => tok.toLowerCase() === base.toLowerCase())) return true;
      const abs = path.join(process.cwd(), fp);
      const text = fs.readFileSync(abs, 'utf8');
      return regexes.some((rx) => rx.test(text));
    });
}

function viewFiles(pathsArr: string[]) {
  const out: Record<string, string> = {};
  for (let p of pathsArr) {
    if (p.startsWith('myApp/')) p = p.replace('myApp/', '');
    const absolute = path.join(APP_ROOT, p);
    if (!fs.existsSync(absolute)) throw new Error(`File not found: myApp/${p}`);
    if (fs.statSync(absolute).isDirectory()) throw new Error(`Cannot view directory: myApp/${p}`);
    out[p] = fs.readFileSync(absolute, 'utf8');
  }
  return out;
}

function writeFiles(edits: Array<{ path: string; content: string }>) {
  for (let { path: p, content } of edits) {
    if (p.startsWith('myApp/')) p = p.replace('myApp/', '');
    assertAllowedWrite(p);
    const absolute = path.join(APP_ROOT, p);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
  }
  return { written: edits.length };
}

function toLiteralRegex(str: string) {
  return new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gms');
}
function safeRegex(src: string) {
  try {
    return new RegExp(src, 'gms');
  } catch {
    return toLiteralRegex(src);
  }
}

function writePatches(patches: { path: string; find: string; replace: string }[]) {
  let applied = 0;
  for (let { path: p, find, replace } of patches) {
    if (p.startsWith('myApp/')) p = p.replace('myApp/', '');
    assertAllowedWrite(p);
    const abs = path.join(APP_ROOT, p);
    let text = fs.readFileSync(abs, 'utf8');
    const rx = safeRegex(find);
    const next = text.replace(rx, replace);
    if (next === text) throw new Error(`[writePatches] pattern not found in ${p}`);
    fs.writeFileSync(abs, next, 'utf8');
    applied++;
  }
  return { patched: applied };
}

async function updateFirestore(chatId: string, data: Record<string, any>) {
  const collectionRef = collection(db, 'chats', chatId, 'messages');
  await addDoc(collectionRef, {
    ...data,
    created_at: serverTimestamp(),
  });
}

/* ───────── controller ───────── */

@Controller('orchestrator')
export class OrchestratorController {
  @Post('')
  async orchestrate(
    @Body() body: OrchestrateDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { prompt, sessionId } = body || ({} as OrchestrateDto);

    if (!sessionId) {
      throw new HttpException('Missing sessionId', HttpStatus.BAD_REQUEST);
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const write = (chunk: string) => res.write(chunk);
    const sendEvent = (event: string, data: unknown) => {
      write(`event: ${event}\n`);
      write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // handshake + session announce
    write('retry: 1000\n\n');
    sendEvent('session', { sessionId });

    // fire-and-forget: store user prompt
    updateFirestore(sessionId, { role: 'user', message: prompt }).catch(() => {});

    let stopped = false;
    let currentStream: any = null;

    // register the run
    RUNS.set(sessionId, {
      abort: () => {
        stopped = true;
        try {
          currentStream?.controller?.abort?.();
        } catch {}
      },
      status: 'running',
    });

    const tee = (event: string, data: any) => {
      // to this caller
      sendEvent(event, data);
      // to other subscribers
      publish(sessionId, event, data);
    };

    let messages: any[] = [{ role: 'user', content: prompt }];
    let assistantTextToStore = '';

    const closeOut = async () => {
      try {
        const rr = RUNS.get(sessionId);
        if (rr) RUNS.set(sessionId, { ...rr, status: 'stopped' });
        setTimeout(() => RUNS.delete(sessionId), 30_000);
      } catch {}
      // final message to Firestore
      const chatId = sessionId;
      try {
        await updateFirestore(chatId, {
          role: 'assistant',
          message: assistantTextToStore,
        });
      } catch (err: any) {
        tee('error', { message: `Failed to update Firestore: ${String(err)}` });
        // keep SSE open semantics consistent with original: do not throw here
      }
      if (!stopped) tee('notice', { message: 'stopped' });
      try {
        res.end();
      } catch {}
    };

    req.on('close', () => {
      stopped = true;
      try {
        currentStream?.controller?.abort?.();
      } catch {}
    });
    req.on('aborted', () => {
      stopped = true;
      try {
        currentStream?.controller?.abort?.();
      } catch {}
    });

    // main orchestration loop
    (async () => {
      while (!stopped) {
        const payload = {
          model: 'claude-sonnet-4-20250514',
          temperature: 0.3,
          max_tokens: 20_000,
          system: getSystemPrompt('orchestrator'),
          tools: TOOLS,
          stream: true,
          messages,
        } as const;

        const claude = anthropic.messages.stream(payload as any);
        currentStream = claude;

        let needAnotherPass = false;
        let insideHypothesis = false;
        let tailBuf = '';

        let activeTool:
          | { id: string; name: string; json: string; pending?: Set<string> }
          | null = null;

        try {
          for await (const event of claude) {
            if (stopped) break;

            // assistant text handling
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const txt = event.delta.text;
              let out = '';
              const chop = (s: string, n: number) => s.slice(0, Math.max(0, s.length - n));

              for (const ch of txt) {
                tailBuf += ch;
                if (tailBuf.length > 40) tailBuf = tailBuf.slice(-40);

                if (insideHypothesis) {
                  if (tailBuf.endsWith('</rofy-hypothesis>')) {
                    insideHypothesis = false;
                    tailBuf = '';
                  }
                  continue;
                }

                if (tailBuf.endsWith('<rofy-hypothesis>')) {
                  insideHypothesis = true;
                  out = chop(out, '<rofy-hypothesis>'.length);
                  tailBuf = '';
                  continue;
                }

                const m = tailBuf.match(/SEARCH_(UI|CLIENT|API)$/);
                if (m) {
                  out = chop(out, m[0].length);
                  continue;
                }

                out += ch;
              }

              if (out.trim()) {
                const delta = { type: 'text_delta', text: out };
                assistantTextToStore += out;
                tee('assistant', { delta });
              }
            }

            // tool_use start
            if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
              activeTool = {
                id: event.content_block.id,
                name: event.content_block.name,
                json: '',
              };

              if (activeTool.name === 'searchFiles' || activeTool.name === 'viewFiles') {
                tee('tool_progress', { status: 'searching' });
              } else {
                tee('tool_progress', { status: 'start', name: activeTool.name });
              }
            }

            // tool_use JSON chunks
            if (
              activeTool &&
              event.type === 'content_block_delta' &&
              event.delta.type === 'input_json_delta'
            ) {
              const chunk = event.delta.partial_json;
              activeTool.json += chunk;

              // pre-emit file-start for partial JSON
              const pathRegex = /"path"\s*:\s*"([^"]+)"/g;
              let m: RegExpExecArray | null;
              while ((m = pathRegex.exec(activeTool.json))) {
                const fullPath = m[1];
                activeTool.pending ??= new Set();
                if (!activeTool.pending.has(fullPath)) {
                  activeTool.pending.add(fullPath);
                  const short = fullPath.replace(/^myApp\//, '').replace(/^client\//, '');
                  tee('tool_progress', {
                    status: 'file-start',
                    verb: activeTool.name === 'writeFiles' ? 'Creating' : 'Updating',
                    path: short,
                  });
                }
              }
            }

            // tool_use stop → execute tool, append tool_result, and loop
            if (activeTool && event.type === 'content_block_stop') {
              const toolInput = JSON.parse(activeTool.json);
              const { name, id } = activeTool;

              messages.push({
                role: 'assistant',
                content: [{ type: 'tool_use', id, name, input: toolInput }],
              });

              let result: any;
              if (name === 'searchFiles') {
                result = searchFiles(toolInput.query, toolInput.includePattern ?? '**/*.{js,ts,jsx,tsx}');
              } else if (name === 'viewFiles') {
                result = viewFiles(toolInput.paths);
              } else if (name === 'writeFiles') {
                result = writeFiles(toolInput.edits);
              } else if (name === 'writePatches') {
                result = writePatches(toolInput.patches);
              } else {
                result = { error: `unknown tool ${name}` };
              }

              // publish tool completion status
              if (name === 'searchFiles' || name === 'viewFiles') {
                tee('tool_progress', { status: 'search-done' });
              } else if (name === 'writeFiles') {
                for (const { path: p } of toolInput.edits) {
                  const short = p.replace(/^myApp\//, '').replace(/^client\//, '');
                  tee('tool_progress', { status: 'file', verb: 'Created', path: short });
                  assistantTextToStore += `<div class="text-sm flex items-center gap-2">
  <span class="text-green-600">✓</span>
  <span class="text-green-700">
    Created ${short}
  </span>
</div>`;
                }
              } else if (name === 'writePatches') {
                for (const { path: p } of toolInput.patches) {
                  const short = p.replace(/^myApp\//, '').replace(/^client\//, '');
                  tee('tool_progress', { status: 'file', verb: 'Updated', path: short });
                  assistantTextToStore += `<div class="text-sm flex items-center gap-2">
  <span class="text-green-600">✓</span>
  <span class="text-green-700">
    Updated ${short}
  </span>
</div>`;
                }
              }

              // return tool_result to Claude
              messages.push({
                role: 'user',
                content: [{ type: 'tool_result', tool_use_id: id, content: JSON.stringify(result) }],
              });

              activeTool = null;
              needAnotherPass = true;

              // stop current streaming pass
              try {
                claude.controller.abort();
              } catch {}
              break;
            }
          }
        } catch (err: any) {
          if (stopped) {
            // tell UI we stopped, but do not close SSE yet
            tee('notice', { message: 'stopped' });
            break;
          }
          tee('error', { message: String(err) });
          break;
        } finally {
          // status updated in closeOut as well; keep here for parity
          const rr = RUNS.get(sessionId);
          if (rr) RUNS.set(sessionId, { ...rr, status: 'stopped' });
          setTimeout(() => RUNS.delete(sessionId), 30_000);
        }

        if (!needAnotherPass) break;
        if (stopped) break;
      }

      await closeOut();
    })().catch(async (e) => {
      try {
        tee('error', { message: String(e) });
      } finally {
        await closeOut();
      }
    });

    // keep the response open; do not return a value
  }

  @Post('stop')
  @HttpCode(200)
  stop(@Body() { sessionId }: StopRunDto) {
    const run = RUNS.get(sessionId);
    if (!run) {
      throw new HttpException(
        { success: false, error: 'Run not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      run.abort?.(); // triggers the controller.abort() on the Claude stream
      RUNS.set(sessionId, { ...run, status: 'stopped' });

      // notify any listeners over your SSE bus
      try {
        publish(sessionId, 'notice', { message: 'stopped' });
      } catch {}

      return { success: true };
    } catch (e: any) {
      throw new HttpException(
        { success: false, error: e?.message ?? String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
