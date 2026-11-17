// Ported from vercel-labs/ui (@ui-sdk/core components/input/input.ts)
// Auto-resizing textarea with CSS field-sizing / fallback and IME composition guard

export function fitContent(el: HTMLTextAreaElement): () => void {
  if (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content")) {
    el.style.setProperty("field-sizing", "content");
    return () => el.style.removeProperty("field-sizing");
  }

  let width = -1;
  const fit = () => {
    el.style.height = "auto";
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borders}px`;
  };
  fit();

  const handleInput = () => fit();
  el.addEventListener("input", handleInput);

  const observer =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(([entry]) => {
          if (entry.contentRect.width === width) return;
          width = entry.contentRect.width;
          fit();
        });
  observer?.observe(el);

  return () => {
    el.removeEventListener("input", handleInput);
    observer?.disconnect();
    el.style.removeProperty("height");
  };
}
