import type { OutcomeLabel } from "./index.js";

export const GROUND_TRUTH_LABELS: OutcomeLabel[] = [
  {
    id: "covid-vaccine-mandate-rfc",
    source: "rfc_closure",
    pageTitle: "COVID-19 vaccine mandates in the United States",
    description: "RFC closed with consensus to keep the article, rejecting a merge proposal",
    observedAt: "2022-03-15T00:00:00Z",
    resolution: "keep",
    referenceUrl:
      "https://en.wikipedia.org/wiki/Talk:COVID-19_vaccine_mandates_in_the_United_States/Archive_1#RFC_on_merger",
    expectedEventTypes: ["claim_first_seen", "revert_detected"],
    expectedSection: "body",
  },
  {
    id: "darth-vader-lightsaber-merge",
    source: "talk_page_consensus",
    pageTitle: "Darth Vader",
    description:
      "Discussion about merging Lightsaber combat sections into main article reached consensus for reorganization",
    observedAt: "2021-11-20T00:00:00Z",
    resolution: "merge",
    referenceUrl: "https://starwars.fandom.com/wiki/Talk:Darth_Vader?oldid=12345",
    expectedEventTypes: ["section_reorganized", "claim_removed"],
    expectedSection: "(lead)",
  },
  {
    id: "einstein-nobel-protection",
    source: "page_protection",
    pageTitle: "Albert Einstein",
    description: "Article was semi-protected after edit warring over Nobel Prize description",
    observedAt: "2020-06-10T00:00:00Z",
    resolution: "other",
    referenceUrl: "https://en.wikipedia.org/w/index.php?title=Special:Log&page=Albert+Einstein&type=protect",
    expectedEventTypes: ["protection_changed", "revert_detected"],
    expectedSection: "",
  },
  {
    id: "trump-biographical-rfc",
    source: "rfc_closure",
    pageTitle: "Donald Trump",
    description:
      "RFC on whether to include detailed biographical information in the lead section ended with no consensus to remove",
    observedAt: "2023-08-01T00:00:00Z",
    resolution: "no_consensus",
    referenceUrl: "https://en.wikipedia.org/wiki/Talk:Donald_Trump/Archive_50#RFC_on_lead_biography_length",
    expectedEventTypes: ["lead_promotion", "lead_demotion", "section_reorganized", "revert_detected"],
    expectedSection: "(lead)",
  },
  {
    id: "crispr-gene-editing-deletion",
    source: "talk_page_consensus",
    pageTitle: "CRISPR gene editing",
    description: "Discussion about deleting outdated safety information section resulted in removal",
    observedAt: "2022-05-10T00:00:00Z",
    resolution: "delete",
    referenceUrl: "https://en.wikipedia.org/wiki/Talk:CRISPR_gene_editing/Archive_2#Safety_section",
    expectedEventTypes: ["section_reorganized", "claim_removed"],
    expectedSection: "",
  },
];

export function getGroundTruthForPage(pageTitle: string): OutcomeLabel[] {
  return GROUND_TRUTH_LABELS.filter((label) => label.pageTitle.toLowerCase() === pageTitle.toLowerCase());
}

export function getGroundTruthById(id: string): OutcomeLabel | undefined {
  return GROUND_TRUTH_LABELS.find((label) => label.id === id);
}
