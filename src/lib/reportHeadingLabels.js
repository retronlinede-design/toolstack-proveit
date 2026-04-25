export const REPORT_DISPLAY_LANGUAGES = ["en", "de"];

export const DEFAULT_REPORT_DISPLAY_LANGUAGE = "en";

export const REPORT_HEADING_LABELS = {
  en: {
    REPORT_TITLE: "Client Report",
    AT_A_GLANCE: "At A Glance",
    YOUR_SITUATION: "Your Situation",
    MAIN_AREAS_OF_CONCERN: "Main Areas Of Concern",
    WHAT_THIS_REPORT_SHOWS: "What This Report Shows",
    MILESTONE_TIMELINE: "Milestone Timeline",
    ISSUE: "Issue",
    WHAT_HAPPENED: "What happened",
    KEY_PROOF: "Key proof",
    WHAT_THIS_MEANS: "What this means",
    KEY_FACTS: "Key Facts",
    CURRENT_POSITION: "Current Position",
    RECOMMENDED_NEXT_STEPS: "Recommended Next Steps",
  },
  de: {
    REPORT_TITLE: "Klientenbericht",
    AT_A_GLANCE: "Auf einen Blick",
    YOUR_SITUATION: "Ihre Situation",
    MAIN_AREAS_OF_CONCERN: "Hauptprobleme",
    WHAT_THIS_REPORT_SHOWS: "Was dieser Bericht zeigt",
    MILESTONE_TIMELINE: "Zeitlicher Überblick",
    ISSUE: "Problem",
    WHAT_HAPPENED: "Was passiert ist",
    KEY_PROOF: "Wichtige Nachweise",
    WHAT_THIS_MEANS: "Was das bedeutet",
    KEY_FACTS: "Wichtige Fakten",
    CURRENT_POSITION: "Aktueller Stand",
    RECOMMENDED_NEXT_STEPS: "Empfohlene nächste Schritte",
  },
};

export function getReportHeadingLabel(key, language = DEFAULT_REPORT_DISPLAY_LANGUAGE) {
  const labels = REPORT_HEADING_LABELS[language] || REPORT_HEADING_LABELS[DEFAULT_REPORT_DISPLAY_LANGUAGE];
  return labels?.[key] || key;
}
