import { CopyTextButton } from "./CopyTextButton";

export function CopyLinkButton({ value }: { value: string }) {
  return <CopyTextButton text={value} label="Copy link" />;
}
