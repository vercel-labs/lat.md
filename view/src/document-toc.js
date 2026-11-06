/** Keep the current section's entire subtree emphasized while its children scroll. */
export function documentTocActiveGroup(items, activeId) {
    const activeIndex = items.findIndex((item) => item.id === activeId);
    const groupIds = new Set();
    const ancestorIds = new Set();
    if (activeIndex === -1)
        return { groupIds, ancestorIds };
    const trail = [];
    for (let i = 0; i <= activeIndex; i++) {
        while (trail.length &&
            items[trail[trail.length - 1]].depth >= items[i].depth)
            trail.pop();
        trail.push(i);
    }
    const sectionTrail = trail.filter((i) => items[i].depth > 1);
    const start = sectionTrail[0] ?? activeIndex;
    groupIds.add(items[start].id);
    if (items[start].depth > 1) {
        for (let i = start + 1; i < items.length && items[i].depth > items[start].depth; i++)
            groupIds.add(items[i].id);
    }
    for (const i of sectionTrail) {
        if (i !== activeIndex)
            ancestorIds.add(items[i].id);
    }
    return { groupIds, ancestorIds };
}
export function activeDocumentTocId(ids, tops, threshold = 96) {
    let active = ids[0] ?? '';
    for (const id of ids) {
        const top = tops.get(id);
        if (top === undefined)
            continue;
        if (top > threshold)
            break;
        active = id;
    }
    return active;
}
export function documentTocIndentationDepth(depth, minimumSubsectionDepth) {
    return depth === 1 ? 0 : Math.max(0, depth - minimumSubsectionDepth);
}
export function documentTocActivationLine({ scrollTop, viewportHeight, scrollHeight, topOffset = 96, }) {
    const offset = Math.max(0, Math.min(topOffset, viewportHeight));
    const maximumScrollTop = Math.max(0, scrollHeight - viewportHeight);
    if (scrollTop <= 0 || maximumScrollTop === 0)
        return offset;
    const remainingScroll = Math.max(0, maximumScrollTop - scrollTop);
    const bottomTravel = Math.max(0, viewportHeight - offset);
    // Near the end of the document, move the activation line down through the
    // viewport so every short final section can cross it before scrolling stops.
    return offset + Math.max(0, bottomTravel - remainingScroll);
}
/** Frame-rate-independent easing that can follow a changing destination. */
export function nextDocumentTocScrollTop(current, target, elapsedMs) {
    if (Math.abs(target - current) < 0.5)
        return target;
    return (current + (target - current) * (1 - Math.exp(-Math.max(0, elapsedMs) / 90)));
}
export function centeredDocumentTocScrollTop({ containerHeight, contentHeight, itemHeight, itemTop, }) {
    const centered = itemTop + itemHeight / 2 - containerHeight / 2;
    return Math.max(0, Math.min(centered, contentHeight - containerHeight));
}
