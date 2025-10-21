// src/components/ProviderTile.tsx
"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Button from "@/components/ui/button";
import Chip from "@/components/ui/chip";

type Props = {
  name: string;
  description?: string;
  apiEnabled?: boolean;
  affiliate?: boolean;
  website?: string;
  onRun?: () => void;
  onCopyOpen?: () => void;
};

export default function ProviderTile({
  name,
  description,
  apiEnabled,
  affiliate,
  website,
  onRun,
  onCopyOpen,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{name}</span>
          {apiEnabled && <Chip color="green">API</Chip>}
          <Chip color="blue">Copy &amp; Open</Chip>
          {affiliate && <Chip color="red">Affiliate</Chip>}
        </CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent>
        {website ? (
          <a
            href={website}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
          >
            {website}
          </a>
        ) : null}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button variant="default" onClick={onRun} className="w-full">
          Run
        </Button>
        <Button variant="outline" onClick={onCopyOpen} className="w-full">
          Copy + Open
        </Button>
      </CardFooter>
    </Card>
  );
}








