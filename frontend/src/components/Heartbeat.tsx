"use client";
import { useEffect, useRef, useState } from "react";

type Props = { periodMinutes?: number; };

export default function Heartbeat({ periodMinutes = 3 }: Props){
  const [active, setActive] = useState(false);
  const ref = useRef<number>();

  useEffect(()=>{
    const periodMs = periodMinutes * 60 * 1000;
    const fire = () => {
      setActive(true);
      window.setTimeout(()=> setActive(false), 3000);
    };
    fire(); // fire on mount
    ref.current = window.setInterval(fire, periodMs) as unknown as number;
    return ()=> { if(ref.current) window.clearInterval(ref.current); };
  }, [periodMinutes]);

  return <div className={`heartbeat-line ${active ? "active" : ""}`} />;
}
