import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { OWNER_NAME } from "@/config";

export default function Terms() {
    return (
        <div className="w-full flex justify-center p-10">
            <div className="w-full max-w-screen-md space-y-6">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 underline"
                >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to Chatbot
                </Link>

                <h1 className="text-3xl font-bold">Assura</h1>
                <h2 className="text-2xl font-semibold">Terms of Use & Disclaimer</h2>

                <p className="text-gray-700">
                    The following Terms of Use govern your access to and use of the Assura
                    life insurance explainer assistant (the &quot;AI Chatbot&quot;), an
                    artificial intelligence tool provided by{" "}
                    <span className="font-semibold">{OWNER_NAME}</span> (&quot;I&quot;, &quot;me&quot;, or &quot;myself&quot;). 
                    By using the AI Chatbot, you agree to these terms. If you do not agree, you may not use the AI Chatbot.
                </p>

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">General Information</h3>
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="text-gray-700">
                            <span className="font-semibold">Nature and Purpose:</span>{" "}
                            The AI Chatbot is developed and maintained by{" "}
                            <span className="font-semibold">{OWNER_NAME}</span>. It is intended
                            only to provide general, educational information about life
                            insurance concepts, terminology, and typical policy features.
                            It is not a substitute for professional financial, legal, tax,
                            or insurance advice.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">No Insurance Sales or Advice:</span>{" "}
                            The AI Chatbot is not an insurance company, broker, corporate
                            agent, web aggregator, or intermediary. It does not:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-2">
                                <li>Sell, solicit, or arrange life insurance policies.</li>
                                <li>Provide personal financial planning or investment advice.</li>
                                <li>Provide recommendations on which specific product, plan, or insurer you should choose.</li>
                            </ul>
                            Any mention of insurers, products, riders, or features is for
                            informational and illustrative purposes only.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">No Guarantee of Accuracy:</span>{" "}
                            Life insurance products, regulations, and tax rules change over time
                            and vary across insurers and jurisdictions. While the AI Chatbot is
                            designed to provide helpful and relevant information, it may at times
                            provide incomplete, outdated, or inaccurate responses. You are
                            responsible for independently verifying all information with:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-2">
                                <li>Your policy documents and official insurer communications.</li>
                                <li>A licensed insurance advisor, financial planner, or legal professional.</li>
                                <li>Applicable laws, regulations, and tax rules.</li>
                            </ul>
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">Third-Party Involvement:</span>{" "}
                            The AI Chatbot uses third-party platforms and vendors to operate,
                            which may be located in other countries. Your inputs may be
                            transmitted, processed, and stored by these third-party systems.
                            As a result, confidentiality, security, and privacy cannot be
                            guaranteed, and data transmission may be inherently insecure and
                            subject to interception.
                        </li>
                    </ol>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Liability</h3>
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="text-gray-700">
                            <span className="font-semibold">Use at Your Own Risk:</span>{" "}
                            The AI Chatbot is provided on an &quot;as-is&quot; and
                            &quot;as-available&quot; basis. To the fullest extent permitted by law:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-2">
                                <li>
                                    <span className="font-semibold">{OWNER_NAME}</span> disclaims all warranties, express or implied,
                                    including but not limited to warranties of merchantability,
                                    fitness for a particular purpose, and non-infringement.
                                </li>
                                <li>
                                    <span className="font-semibold">{OWNER_NAME}</span> is not responsible for any errors, omissions,
                                    misstatements, or misinterpretations in the information
                                    generated by the AI Chatbot.
                                </li>
                            </ul>
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">No Responsibility for Decisions:</span>{" "}
                            Any decisions you make about buying, modifying, or cancelling a
                            life insurance policy, filing a claim, or undertaking any
                            financial or legal action are solely your responsibility. You
                            should always consult the relevant insurer, official policy
                            documents, and qualified professionals before making such decisions.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">No Responsibility for Damages:</span>{" "}
                            Under no circumstances shall{" "}
                            <span className="font-semibold">{OWNER_NAME}</span>, or any collaborators,
                            partners, affiliated entities, or representatives be liable for
                            any direct, indirect, incidental, consequential, special, or
                            punitive damages arising out of or connected with your use or
                            inability to use the AI Chatbot.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">Modification or Discontinuation:</span>{" "}
                            I reserve the right to modify, suspend, or discontinue the AI
                            Chatbot, including any of its features or content, at any time
                            without prior notice.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">Future Fees:</span>{" "}
                            While the AI Chatbot is currently provided free of charge, I
                            reserve the right to introduce fees or paid tiers for usage at
                            any time.
                        </li>
                    </ol>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">User Responsibilities</h3>
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="text-gray-700">
                            <span className="font-semibold">Eligibility:</span>{" "}
                            Use of the AI Chatbot is restricted to individuals who are 18
                            years of age or older, or the age of legal majority in their
                            jurisdiction, whichever is higher.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">No Sensitive or Confidential Information:</span>{" "}
                            You should not share sensitive personal or financial information
                            through the AI Chatbot, including but not limited to:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-2">
                                <li>Policy numbers, claim reference numbers, or full ID documents.</li>
                                <li>Bank account details, credit/debit card details, passwords, or OTPs.</li>
                                <li>Aadhaar, PAN, Social Security numbers, or similar identifiers.</li>
                                <li>Detailed medical records or highly sensitive health information.</li>
                            </ul>
                            For any policy-specific or claim-specific questions, you should
                            contact the insurer or their authorized representatives directly
                            using official channels.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">Prohibited Conduct:</span>{" "}
                            By using the AI Chatbot, you agree not to:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-2">
                                <li>
                                    Post or transmit content that is defamatory, offensive,
                                    threatening, illegal, racist, discriminatory, obscene, or otherwise inappropriate.
                                </li>
                                <li>
                                    Use the AI Chatbot to engage in unlawful, fraudulent, or unethical activities.
                                </li>
                                <li>
                                    Attempt to compromise, disrupt, or interfere with the security or functionality of the AI Chatbot.
                                </li>
                                <li>
                                    Copy, distribute, modify, reverse engineer, decompile, or attempt to extract the source code of the AI Chatbot without explicit written consent.
                                </li>
                            </ul>
                        </li>
                    </ol>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Data Privacy and Security</h3>
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="text-gray-700">
                            <span className="font-semibold">No Absolute Privacy Guarantee:</span>{" "}
                            While reasonable efforts may be made to protect your information,
                            the AI Chatbot cannot guarantee privacy, confidentiality, or
                            security of the information you provide. Conversations may be
                            reviewed by{" "}
                            <span className="font-semibold">{OWNER_NAME}</span>, collaborators,
                            partners, or affiliated entities for purposes such as improving
                            the AI Chatbot, analyzing usage, or developing educational content.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">Data Use:</span>{" "}
                            Your inputs and the AI-generated outputs may be stored and used
                            to:
                            <ul className="list-disc list-inside ml-6 mt-2 space-y-2">
                                <li>Improve the accuracy and usefulness of the AI Chatbot.</li>
                                <li>Generate aggregate, anonymized insights about how users interact with life insurance information.</li>
                                <li>Develop related tools, content, or services.</li>
                            </ul>
                            Personal identifiers, if accidentally shared, may form part of
                            stored logs. You are responsible for minimizing such disclosure.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">Third-Party Processing:</span>{" "}
                            Inputs may be transmitted to and processed by third-party AI and
                            infrastructure providers. Their terms of service and privacy
                            policies may apply in addition to these terms.
                        </li>
                    </ol>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Ownership of Content and Use Rights</h3>
                    <ol className="list-decimal list-inside space-y-3">
                        <li className="text-gray-700">
                            <span className="font-semibold">License to Use Your Inputs:</span>{" "}
                            By using the AI Chatbot, you grant{" "}
                            <span className="font-semibold">{OWNER_NAME}</span> a worldwide,
                            non-exclusive, royalty-free, irrevocable license to use, store,
                            reproduce, modify, and create derivative works from your inputs
                            and the AI-generated outputs for the purposes of operating,
                            improving, and promoting the AI Chatbot and related services.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">No Confidential Relationship:</span>{" "}
                            Your use of the AI Chatbot does not create any client–advisor,
                            fiduciary, or confidential relationship. Do not submit information
                            that you expect to be treated as legally confidential.
                        </li>
                        <li className="text-gray-700">
                            <span className="font-semibold">No Claim to Gains or Profits:</span>{" "}
                            You agree that you have no rights, claims, or entitlement to any
                            gains, profits, or benefits derived from{" "}
                            <span className="font-semibold">{OWNER_NAME}</span>&apos;s use of the AI Chatbot, your inputs, or the AI-generated outputs.
                        </li>
                    </ol>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Indemnification</h3>
                    <p className="text-gray-700">
                        By using the AI Chatbot, you agree to indemnify and hold harmless{" "}
                        <span className="font-semibold">{OWNER_NAME}</span>, together with any
                        collaborators, partners, affiliated entities, and representatives,
                        from and against any claims, damages, losses, liabilities, costs, or
                        expenses (including legal fees) arising out of or related to:
                    </p>
                    <ul className="list-disc list-inside ml-6 space-y-2 text-gray-700">
                        <li>Your use or misuse of the AI Chatbot.</li>
                        <li>Your violation of these Terms of Use.</li>
                        <li>Your infringement of any rights of a third party.</li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Governing Law and Jurisdiction</h3>
                    <p className="text-gray-700">
                        These terms are governed by the laws of India, subject to applicable
                        local laws in the jurisdiction where you reside. In the event of any
                        dispute arising out of or in connection with these terms or your use
                        of the AI Chatbot, you agree that such dispute shall be subject to
                        the exclusive jurisdiction of the competent courts in India, unless
                        otherwise required by mandatory local law.
                    </p>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Acceptance of Terms</h3>
                    <p className="text-gray-700">
                        By using the AI Chatbot, you confirm that you have read, understood,
                        and agree to be bound by these Terms of Use and Disclaimer. If you do
                        not agree with any part of these terms, you must not use the AI Chatbot.
                    </p>
                </div>

                <div className="mt-8 text-sm text-gray-600">
                    <p>Last Updated: November 27, 2025</p>
                </div>
            </div>
        </div>
    );
}
