import { describe, it, expect } from "vitest";
import { templateTracker, diffTemplateParams, buildParamChangeEvents } from "../template-tracker.js";
import type { Template } from "../index.js";

const TMPL_A: Template = {
  name: "Infobox character",
  type: "other",
  params: { name: "Darth Vader", status: "alive", affiliation: "Sith" },
};

const TMPL_B: Template = {
  name: "Infobox character",
  type: "other",
  params: { name: "Darth Vader", status: "deceased", affiliation: "Sith" },
};

const TMPL_C: Template = {
  name: "Infobox character",
  type: "other",
  params: { name: "Darth Vader", status: "deceased", affiliation: "Galactic Empire" },
};

describe("extractTemplates", () => {
  it("extracts a simple template", () => {
    const templates = templateTracker.extractTemplates("{{citation needed}}");
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe("citation needed");
    expect(templates[0].type).toBe("citation");
  });

  it("extracts templates with parameters", () => {
    const wikitext = "{{Infobox person|name=John|age=30}}";
    const templates = templateTracker.extractTemplates(wikitext);
    expect(templates).toHaveLength(1);
    expect(templates[0].params).toBeDefined();
    expect(templates[0].params!.name).toBe("John");
  });

  it("extracts multiple templates", () => {
    const wikitext = "{{npov}} text {{citation needed}} more {{BLP sources}}";
    const templates = templateTracker.extractTemplates(wikitext);
    expect(templates.length).toBeGreaterThanOrEqual(3);
  });

  it("returns empty for no templates", () => {
    expect(templateTracker.extractTemplates("Plain text.")).toEqual([]);
  });

  it("deduplicates identical templates", () => {
    const templates = templateTracker.extractTemplates("{{foo}}{{foo}}");
    expect(templates).toHaveLength(1);
  });

  it("handles nested templates", () => {
    const wikitext = "{{Infobox|data={{nested}}}}";
    const templates = templateTracker.extractTemplates(wikitext);
    expect(templates).toHaveLength(1);
  });
});

describe("diffTemplates", () => {
  it("detects added templates", () => {
    const before = templateTracker.extractTemplates("plain text");
    const after = templateTracker.extractTemplates("plain text {{citation needed}}");
    const changes = templateTracker.diffTemplates(before, after);
    const added = changes.filter((c) => c.type === "added");
    expect(added).toHaveLength(1);
    expect(added[0].template.name).toBe("citation needed");
  });

  it("detects removed templates", () => {
    const before = templateTracker.extractTemplates("text {{npov}} more");
    const after = templateTracker.extractTemplates("text more");
    const changes = templateTracker.diffTemplates(before, after);
    expect(changes.filter((c) => c.type === "removed")).toHaveLength(1);
  });

  it("marks unchanged templates", () => {
    const before = templateTracker.extractTemplates("text {{citation needed}} more");
    const after = templateTracker.extractTemplates("text {{citation needed}} more");
    const changes = templateTracker.diffTemplates(before, after);
    expect(changes.filter((c) => c.type === "unchanged")).toHaveLength(1);
  });

  it("handles both added and removed simultaneously", () => {
    const before = templateTracker.extractTemplates("{{a}} text");
    const after = templateTracker.extractTemplates("text {{b}}");
    const changes = templateTracker.diffTemplates(before, after);
    expect(changes.filter((c) => c.type === "added")).toHaveLength(1);
    expect(changes.filter((c) => c.type === "removed")).toHaveLength(1);
  });
});

describe("diffTemplateParams", () => {
  it("detects a parameter change", () => {
    const changes = diffTemplateParams([TMPL_A], [TMPL_B]);
    expect(changes).toHaveLength(1);
    expect(changes[0].paramName).toBe("status");
    expect(changes[0].oldValue).toBe("alive");
    expect(changes[0].newValue).toBe("deceased");
  });

  it("detects a parameter added", () => {
    const before: Template = { name: "Infobox", type: "other", params: { name: "Test" } };
    const after: Template = { name: "Infobox", type: "other", params: { name: "Test", newParam: "value" } };

    const changes = diffTemplateParams([before], [after]);
    const added = changes.find((c) => c.paramName === "newparam");
    expect(added).toBeDefined();
    expect(added!.oldValue).toBeUndefined();
    expect(added!.newValue).toBe("value");
  });

  it("detects a parameter removed", () => {
    const before: Template = { name: "Infobox", type: "other", params: { name: "Test", oldParam: "value" } };
    const after: Template = { name: "Infobox", type: "other", params: { name: "Test" } };

    const changes = diffTemplateParams([before], [after]);
    const removed = changes.find((c) => c.paramName === "oldparam");
    expect(removed).toBeDefined();
    expect(removed!.oldValue).toBe("value");
    expect(removed!.newValue).toBeUndefined();
  });

  it("returns empty when no params changed", () => {
    const changes = diffTemplateParams([TMPL_A], [{ ...TMPL_A }]);
    expect(changes).toHaveLength(0);
  });

  it("does not process templates not present in both revisions", () => {
    const different: Template = { name: "Other template", type: "other", params: { x: "y" } };
    const changes = diffTemplateParams([TMPL_A], [different]);
    expect(changes).toHaveLength(0);
  });

  it("normalizes parameter names (lowercase, trimmed)", () => {
    const before: Template = { name: "Infobox", type: "other", params: { "  Name ": "Old" } };
    const after: Template = { name: "Infobox", type: "other", params: { name: "New" } };

    const changes = diffTemplateParams([before], [after]);
    expect(changes).toHaveLength(1);
    expect(changes[0].paramName).toBe("name");
    expect(changes[0].oldValue).toBe("Old");
    expect(changes[0].newValue).toBe("New");
  });
});

describe("buildParamChangeEvents", () => {
  it("produces template_parameter_changed events", () => {
    const events = buildParamChangeEvents([TMPL_A], [TMPL_C], 1, 2, "2026-01-01T00:00:00Z");
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("template_parameter_changed");
    expect(events[0].fromRevisionId).toBe(1);
    expect(events[0].toRevisionId).toBe(2);
    expect(events[0].layer).toBe("observed");
    const details = events.map((e) => e.deterministicFacts[0].detail ?? "");
    expect(details.some((d) => d.includes("affiliation"))).toBe(true);
  });
});
