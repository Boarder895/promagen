"use client";
export default function ProgressBar({ value=0 }: { value?: number }) {
  return (
    <div style={{width:"100%", background:"#eee", borderRadius:999, height:6}}>
      <div style={{width:`${Math.min(100, Math.max(0, value))}%`, background:"#999", height:"100%", borderRadius:999}} />
    </div>
  );
}
