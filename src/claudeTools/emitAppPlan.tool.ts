// src/claude/emitAppPlan.tool.ts

export const emitAppPlanTool = {
    name: "emit_app_plan",
    description:
        "Return the final (new or edited) app plan as a single JSON object matching the required schema.",
    input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
            intent: {
                type: "string",
                enum: ["APP_INTENT"],
                description: "Always 'APP_INTENT' for successful plan outputs. NON_INTENT/POLICY_BLOCK are handled without this tool.",
            },
            appName: { type: "string" },
            description: {
                type: "string",
                description: "1–2 sentence acknowledgement/summary. For EDITS, include compact change summary: +Feature (add), −Feature (remove), ~Feature (edit).",
            },
            icon: {
                type: "string",
                description: "React Icons component name (e.g., FiShoppingBag, AiOutlineDashboard, MdOutlineTaskAlt, RiBook2Line).",
            },
            initialVersion: {
                type: "object",
                additionalProperties: false,
                properties: {
                    summary: { type: "string" },
                    features: {
                        type: "array",
                        minItems: 1,
                        items: { type: "string" },
                        description: "All MVP features. If user listed many, include them all. If vague, include 5–6 essential features for this app type.",
                    },
                },
                required: ["summary", "features"],
            },
            laterVersion: {
                type: "object",
                additionalProperties: false,
                properties: {
                    summary: { type: "string" },
                    features: {
                        type: "array",
                        minItems: 0,
                        maxItems: 4,
                        items: { type: "string" },
                        description: "3–4 meaningful upgrades beyond MVP.",
                    },
                },
                required: ["summary", "features"],
            },
            designLanguage: {
                type: "object",
                additionalProperties: false,
                properties: {
                    summary: { type: "string" },
                    styles: {
                        type: "array",
                        minItems: 1,
                        items: { type: "string" },
                        description: 'Key tokens like themeColor, secondaryColor, fontFamily. Defaults if unspecified: "#2563EB", "#FACC15", "Inter".',
                    },
                },
                required: ["summary", "styles"],
            },
        },
        required: [
            "intent",
            "appName",
            "description",
            "icon",
            "initialVersion",
            "laterVersion",
            "designLanguage",
        ],
    },
}

// Optional TS type (handy in your codebase)
export type AppPlan = {
    intent: "APP_INTENT";
    appName: string;
    description: string; // intro / change summary
    icon: string;
    initialVersion: { summary: string; features: string[] };
    laterVersion: { summary: string; features: string[] };
    designLanguage: { summary: string; styles: string[] };
};
