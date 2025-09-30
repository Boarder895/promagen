"use client";

import React, { type ComponentProps } from "react";
import RealPromptCard from "./prompts/PromptCard";

// Infer the "item" type from the real card to keep typings aligned.
type RealProps = ComponentProps<typeof RealPromptCard>;
type ItemType = RealProps extends { item: infer T } ? T : unknown;
export type Prompt = ItemType;

export default function PromptCard({ p }: { p: ItemType }) {
  return <RealPromptCard item={p} />;
}