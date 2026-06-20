import type { PromptDefinition } from "./types.js";

export const prompts: PromptDefinition[] = [
  {
    name: "author_kavio_video",
    description: "Generate a Kavio video composition (JSON) from a natural-language brief.",
    arguments: [
      { name: "brief", description: "What the video should contain", required: true },
      { name: "width", description: "Canvas width in px (default 1080)", required: false },
      { name: "height", description: "Canvas height in px (default 1920)", required: false },
      { name: "durationSeconds", description: "Duration in seconds (default 10)", required: false }
    ],
    render: (args) =>
      [
        "You are authoring a Kavio video composition as JSON.",
        "",
        `Brief: ${args.brief}`,
        `Canvas: ${args.width ?? "1080"}x${args.height ?? "1920"}, duration ${args.durationSeconds ?? "10"}s @ 30fps.`,
        "",
        "Rules:",
        "- Follow the schema resource `kavio://schema/0.1.json` exactly; use only allowed enum values (`kavio://enums.json`).",
        "- Use `kavio://examples/basic.json` as a structural reference.",
        "- Time is in integer frames; positions in composition pixels; anchor defaults to top-left.",
        "- Emit ONLY valid Kavio JSON, no prose.",
        "",
        "Then call `validate_composition`. If it returns errors, fix the exact JSON paths and re-validate until it passes."
      ].join("\n")
  },
  {
    name: "repair_kavio_json",
    description: "Repair a Kavio composition using structured validation errors.",
    arguments: [
      { name: "document", description: "The invalid Kavio JSON", required: true },
      { name: "errors", description: "The errors array returned by validate_composition (JSON)", required: true }
    ],
    render: (args) =>
      [
        "The following Kavio composition failed validation.",
        "",
        "Document:",
        args.document,
        "",
        "Errors (each has a JSON `path`):",
        args.errors,
        "",
        "Fix ONLY the fields at the listed paths. Do not restructure anything else.",
        "Return the corrected full Kavio JSON, then call `validate_composition` again to confirm."
      ].join("\n")
  },
  {
    name: "adapt_for_platform",
    description: "Adapt a Kavio composition to a platform export preset.",
    arguments: [
      { name: "document", description: "The Kavio JSON to adapt", required: true },
      { name: "platform", description: "Target preset: reels | square | landscape", required: true }
    ],
    render: (args) =>
      [
        `Adapt this Kavio composition for the "${args.platform}" platform preset (see \`kavio://presets.json\`).`,
        "Set the export to the target dimensions and adjust layer positions / safe areas so the layout fits the new aspect ratio.",
        "Prefer per-export layerOverrides over editing shared layers where possible.",
        "",
        "Document:",
        args.document
      ].join("\n")
  }
];
