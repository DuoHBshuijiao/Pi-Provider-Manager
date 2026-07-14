/** 将 Zod/校验 path 尽量定位到表单控件（data-config-path） */
export function focusConfigPath(path: string): boolean {
  const normalized = path.replace(/^\//, "").replace(/\//g, ".");
  if (!normalized || normalized === "(root)" || normalized === "root") {
    return false;
  }

  const candidates = [normalized];
  // providers.foo.models.0.id → 也可落到 models.0 卡片
  const parts = normalized.split(".");
  while (parts.length > 2) {
    parts.pop();
    candidates.push(parts.join("."));
  }

  for (const candidate of candidates) {
    const el = document.querySelector(
      `[data-config-path="${CSS.escape(candidate)}"]`,
    ) as HTMLElement | null;
    if (!el) continue;

    let node: HTMLElement | null = el;
    while (node) {
      if (node.tagName === "DETAILS") {
        (node as HTMLDetailsElement).open = true;
      }
      node = node.parentElement;
    }

    const card = el.closest(".model-card");
    if (card && !card.querySelector(".model-card-body")) {
      card.querySelector<HTMLButtonElement>(".model-card-toggle")?.click();
      window.setTimeout(() => {
        const again = document.querySelector(
          `[data-config-path="${CSS.escape(normalized)}"]`,
        ) as HTMLElement | null;
        (again ?? el).focus?.();
        (again ?? el).scrollIntoView({ block: "center", behavior: "smooth" });
      }, 50);
      return true;
    }

    el.focus?.();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  }

  return false;
}

export function providerNameFromPath(path: string): string | null {
  const normalized = path.replace(/^\//, "").replace(/\//g, ".");
  const match = /^providers\.([^.]+)/.exec(normalized);
  return match?.[1] ?? null;
}
