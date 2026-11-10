"use client";

import { useEffect, useState } from "react";
import BranchedMenu, { type BranchedMenuItem } from "@/components/BranchedMenu";

/** Help page side menu: groups branch off a trunk line; picking a topic jumps to its section. */
export function HelpMenu({
  groups,
}: {
  groups: { title: string; sections: { id: string; title: string }[] }[];
}) {
  const items: BranchedMenuItem[] = groups.map((g) => ({
    label: g.title,
    children: g.sections.map((s) => ({ value: s.id, label: s.title })),
  }));
  const ids = groups.flatMap((g) => g.sections.map((s) => s.id));
  const [current, setCurrent] = useState(ids[0]);

  // Scroll-spy: the topic whose section is nearest the top of the page is the current one.
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setCurrent(first);
      },
      // A band just under the sticky header, so a section counts once it reaches the top.
      { rootMargin: "-96px 0px -60% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    // The last section can never reach the top band, so it counts once it is fully on screen.
    const last = document.getElementById(ids[ids.length - 1]!);
    const end = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setCurrent(ids[ids.length - 1]);
      },
      { threshold: 0.99 },
    );
    if (last) end.observe(last);
    return () => {
      observer.disconnect();
      end.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids come from static content
  }, []);

  return (
    <BranchedMenu
      items={items}
      // Only the group you are reading stays open, so the menu stays short.
      defaultOpen={0}
      activeValue={current}
      accordion
      width={280}
      indent={36}
      fontSize={14}
      color="var(--foreground)"
      accentColor="var(--foreground)"
      lineColor="color-mix(in srgb, var(--foreground) 22%, transparent)"
      // The section ids carry scroll-mt, so setting the hash scrolls with the right offset.
      onSelect={(id) => {
        window.location.hash = id;
      }}
    />
  );
}
