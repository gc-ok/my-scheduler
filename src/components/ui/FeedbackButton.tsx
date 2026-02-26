/* ============================================================
   BETA FEEDBACK BUTTON
   To remove after beta: delete this file, FeedbackButton.module.css,
   and the <FeedbackButton /> line in App.tsx.
   ============================================================ */

// TODO: Replace with your Google Form URL before shipping
const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdGy7U3CcPufPVUfptZ4OoIum7GRrrYkvDB51Ze4Z7QFoyxvA/viewform";

import css from "./FeedbackButton.module.css";

export default function FeedbackButton() {
  return (
    <a
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={css.feedbackBtn}
      aria-label="Give feedback (opens in new tab)"
    >
      <span className={css.betaBadge}>Beta</span>
      Give Feedback
    </a>
  );
}
