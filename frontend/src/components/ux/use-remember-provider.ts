"use client";

import { useEffect } from "react";

const KEY = "lastProvider";

export function useRememberProvider(id: string) {
  useEffect(() => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }, [id]);
}



