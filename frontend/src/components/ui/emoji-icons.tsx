import * as React from "react";
import { Emoji } from "@/components/ui/emoji";

/**
 * Small helper components that group category names used around the app.
 * These are optional; they just keep JSX readable.
 */

export const Trends = (p: { className?: string }) => <Emoji name="trends" {...p} />;
export const Core = (p: { className?: string }) => <Emoji name="core" {...p} />;
export const Finance = (p: { className?: string }) => <Emoji name="finance" {...p} />;
export const Currencies = (p: { className?: string }) => <Emoji name="currencies" {...p} />;
export const Weather = (p: { className?: string }) => <Emoji name="weather" {...p} />;
export const Space = (p: { className?: string }) => <Emoji name="space" {...p} />;
export const Sports = (p: { className?: string }) => <Emoji name="sports" {...p} />;
export const Seasons = (p: { className?: string }) => <Emoji name="seasons" {...p} />;
export const Alerts = (p: { className?: string }) => <Emoji name="alerts" {...p} />;
export const UI = (p: { className?: string }) => <Emoji name="ui" {...p} />;
export const Transport = (p: { className?: string }) => <Emoji name="transport" {...p} />;
export const Science = (p: { className?: string }) => <Emoji name="science" {...p} />;
export const Tech = (p: { className?: string }) => <Emoji name="tech" {...p} />;

