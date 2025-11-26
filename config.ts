import { openai } from "@ai-sdk/openai";
import { fireworks } from "@ai-sdk/fireworks";
import { wrapLanguageModel, extractReasoningMiddleware } from "ai";

export const MODEL = openai('gpt-4.1');

// If you want to use a Fireworks model, uncomment the following code and set the FIREWORKS_API_KEY in Vercel
// NOTE: Use middleware when the reasoning tag is different than think. (Use ChatGPT to help you understand the middleware)
// export const MODEL = wrapLanguageModel({
//     model: fireworks('fireworks/deepseek-r1-0528'),
//     middleware: extractReasoningMiddleware({ tagName: 'think' }), // Use this only when using Deepseek
// });


function getDateAndTime(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
    return `The day today is ${dateStr} and the time right now is ${timeStr}.`;
}

export const DATE_AND_TIME = getDateAndTime();

export const AI_NAME = "InsureYou";
export const OWNER_NAME = "Gayatri Sathian";

export const WELCOME_MESSAGE = `Hello! I'm ${AI_NAME}, an AI assistant created by ${OWNER_NAME}.`

export const CLEAR_CHAT_TEXT = "New";

export const MODERATION_DENIAL_MESSAGE_SEXUAL =
  "I can't discuss explicit sexual content. Please ask something else.";

export const MODERATION_DENIAL_MESSAGE_SEXUAL_MINORS =
  "I can't discuss content involving minors in a sexual context. Please ask something else.";

export const MODERATION_DENIAL_MESSAGE_HARASSMENT =
  "I can't engage with harassing content. Please be respectful.";

export const MODERATION_DENIAL_MESSAGE_HARASSMENT_THREATENING =
  "I can't engage with threatening or harassing content. Please be respectful.";

export const MODERATION_DENIAL_MESSAGE_HATE =
  "I can't engage with hateful content. Please be respectful.";

export const MODERATION_DENIAL_MESSAGE_HATE_THREATENING =
  "I can't engage with threatening hate speech. Please be respectful.";

export const MODERATION_DENIAL_MESSAGE_ILLICIT =
  "I can't discuss illegal activities. Please ask something else.";

export const MODERATION_DENIAL_MESSAGE_ILLICIT_VIOLENT =
  "I can't discuss violent illegal activities. Please ask something else.";

export const MODERATION_DENIAL_MESSAGE_SELF_HARM =
  "I can't discuss self-harm. If you're struggling, please reach out to a mental health professional or crisis helpline.";

export const MODERATION_DENIAL_MESSAGE_SELF_HARM_INTENT =
  "I can't discuss self-harm intentions. If you're struggling, please reach out to a mental health professional or crisis helpline.";

export const MODERATION_DENIAL_MESSAGE_SELF_HARM_INSTRUCTIONS =
  "I can't provide instructions related to self-harm. If you're struggling, please reach out to a mental health professional or crisis helpline.";

export const MODERATION_DENIAL_MESSAGE_VIOLENCE =
  "I can't discuss violent content. Please ask something else.";

export const MODERATION_DENIAL_MESSAGE_VIOLENCE_GRAPHIC =
  "I can't discuss graphic violent content. Please ask something else.";

export const MODERATION_DENIAL_MESSAGE_MEDICAL =
  "I can’t give medical advice or diagnose health conditions. Please speak to a qualified doctor.";

export const MODERATION_DENIAL_MESSAGE_LEGAL =
  "I can’t offer legal guidance or interpret laws. A licensed legal professional can help with that.";

export const MODERATION_DENIAL_MESSAGE_FINANCIAL =
  "I can’t provide personalised financial advice. Please consult a certified financial advisor.";

export const MODERATION_DENIAL_MESSAGE_FRAUD =
  "I can’t assist with claim manipulation, falsifying information, or anything that misrepresents a case.";

export const MODERATION_DENIAL_MESSAGE_IDENTITY =
  "I can’t help with impersonating someone or accessing another person’s policy details.";

export const MODERATION_DENIAL_MESSAGE_PRIVACY =
  "I can’t access or retrieve private customer information. Please contact your insurer directly.";

export const MODERATION_DENIAL_MESSAGE_INTERNAL =
  "I can’t discuss internal processes, confidential data, or restricted company information.";

export const MODERATION_DENIAL_MESSAGE_ILLEGAL =
  "I can’t assist with unlawful activities. Please ask something else.";

export const MODERATION_DENIAL_MESSAGE_SAFETY =
  "I can’t engage with messages about harm or violence. If you're struggling, please reach out to someone you trust or a professional.";

export const MODERATION_DENIAL_MESSAGE_ABUSE =
  "I can’t respond to abusive, threatening, or harassing content. Please keep the conversation respectful.";

export const MODERATION_DENIAL_MESSAGE_GRAPHIC =
  "I can’t discuss graphic or disturbing material. Please ask something else.";

export const MODERATION_DENIAL_MESSAGE_VIOLENT =
  "I can’t provide explanations or guidance related to violent acts.";

export const MODERATION_DENIAL_MESSAGE_GUARANTEE =
  "I can’t guarantee claim outcomes or approvals.";

export const MODERATION_DENIAL_MESSAGE_PREMIUM =
  "I can’t assist with bypassing underwriting or altering premiums.";

export const MODERATION_DENIAL_MESSAGE_UNDERWRITING =
  "I can’t influence, override, or fast-track underwriting decisions.";

export const MODERATION_DENIAL_MESSAGE_CONTRACT =
  "I can’t draft, edit, or modify policy contracts.";

export const MODERATION_DENIAL_MESSAGE_CLAIM_DECISION =
  "I can’t make claim decisions or override an insurer’s assessment.";

export const MODERATION_DENIAL_MESSAGE_MISUSE =
  "I can’t help with misusing a policy, an add-on, or any insurance feature.";

export const MODERATION_DENIAL_MESSAGE_RISKY_INSTRUCTIONS =
  "I can’t guide or encourage risky actions that could harm you or others.";

export const MODERATION_DENIAL_MESSAGE_POLICY_REWRITE =
  "I can’t rewrite policy wording or create customised legal clauses.";

export const MODERATION_DENIAL_MESSAGE_SYSTEM_BYPASS =
  "I can’t assist with bypassing insurer systems, KYC rules, or verification steps.";

export const MODERATION_DENIAL_MESSAGE_DATA_EXTRACTION =
  "I can’t pull data from databases, government portals, insurer systems, or private accounts.";

export const MODERATION_DENIAL_MESSAGE_FORGERY =
  "I can’t help with altering documents, certificates, claim forms, or IDs.";

export const MODERATION_DENIAL_MESSAGE_IMPROPER_MEDICAL_DOCS =
  "I can’t help create or modify medical documents for insurance use.";

export const MODERATION_DENIAL_MESSAGE_POLICY_CIRCUMVENT =
  "I can’t assist with finding ways around policy exclusions or waiting periods.";

export const MODERATION_DENIAL_MESSAGE_BLACKHAT =
  "I can’t assist with hacking, brute-forcing, or exploiting digital systems.";

export const MODERATION_DENIAL_MESSAGE_RESTRICTED_CONTENT =
  "I can’t support requests that involve restricted or unsafe content.";

export const MODERATION_DENIAL_MESSAGE_DEFAULT =
  "I can’t help with that request.";


export const PINECONE_TOP_K = 40;
export const PINECONE_INDEX_NAME = "my-ai";
