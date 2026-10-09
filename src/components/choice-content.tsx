import type { Choice } from "@/lib/domain";

export function ChoiceContent({ choice }: { choice: Choice }) {
  return <span className="choice-content">
    {choice.html ? <span dangerouslySetInnerHTML={{ __html: choice.html }} /> : choice.text && <span>{choice.text}</span>}
    {/* These source images are small inline assets or trusted bank-hosted diagrams. */}
    {/* eslint-disable @next/next/no-img-element */}
    {choice.imageData && <img src={choice.imageData} alt={`Option ${choice.id}`} />}
    {choice.imageUrl && <img src={choice.imageUrl} alt={`Option ${choice.id}`} />}
    {/* eslint-enable @next/next/no-img-element */}
    {!choice.text && !choice.html && !choice.imageData && !choice.imageUrl && <span className="choice-unavailable">Choice content unavailable</span>}
  </span>;
}
