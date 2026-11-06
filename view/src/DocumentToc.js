import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { activeDocumentTocId, centeredDocumentTocScrollTop, documentTocActivationLine, documentTocIndentationDepth, documentTocActiveGroup, nextDocumentTocScrollTop, } from './document-toc';
function TocIcon() {
    return (_jsxs("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", children: [_jsx("path", { d: "M9 6h11" }), _jsx("path", { d: "M12 12h8" }), _jsx("path", { d: "M15 18h5" }), _jsx("path", { d: "M5 6v.01" }), _jsx("path", { d: "M8 12v.01" }), _jsx("path", { d: "M11 18v.01" })] }));
}
export function DocumentToc({ gitEnabled, items, onNavigate, }) {
    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const subsectionDepths = items
        .filter((item) => item.depth > 1)
        .map((item) => item.depth);
    const minimumSubsectionDepth = subsectionDepths.length > 0 ? Math.min(...subsectionDepths) : 2;
    const [activeId, setActiveId] = useState(ids[0] ?? '');
    const { groupIds, ancestorIds } = useMemo(() => documentTocActiveGroup(items, activeId), [items, activeId]);
    const [expanded, setExpanded] = useState(false);
    const navigationRef = useRef(null);
    const scrollAnimation = useRef({ frame: 0, target: 0, position: 0, time: 0 });
    useEffect(() => {
        const navigation = navigationRef.current;
        const animation = scrollAnimation.current;
        const stop = () => {
            window.cancelAnimationFrame(animation.frame);
            animation.frame = 0;
        };
        navigation?.addEventListener('wheel', stop, { passive: true });
        navigation?.addEventListener('touchstart', stop, { passive: true });
        navigation?.addEventListener('pointerdown', stop);
        navigation?.addEventListener('keydown', stop);
        return () => {
            stop();
            navigation?.removeEventListener('wheel', stop);
            navigation?.removeEventListener('touchstart', stop);
            navigation?.removeEventListener('pointerdown', stop);
            navigation?.removeEventListener('keydown', stop);
        };
    }, []);
    const [indicators, setIndicators] = useState([]);
    const indicatorIds = useRef(ids);
    useLayoutEffect(() => {
        const navigation = navigationRef.current;
        if (!navigation)
            return;
        const links = [
            ...navigation.querySelectorAll('.document-toc-link'),
        ];
        const measure = () => {
            if (!navigation.clientHeight)
                return;
            const next = links.flatMap((link, index) => {
                if (!link.hasAttribute('aria-current') &&
                    !link.hasAttribute('data-active-ancestor'))
                    return [];
                const insetTop = index === 0 ? 0 : 4;
                const insetBottom = index === links.length - 1 ? 0 : 4;
                return [
                    {
                        depth: Number(link.style.getPropertyValue('--toc-depth')),
                        top: link.offsetTop + insetTop,
                        height: Math.max(0, link.offsetHeight - insetTop - insetBottom),
                        visible: true,
                    },
                ];
            });
            const sameDocument = indicatorIds.current === ids;
            indicatorIds.current = ids;
            setIndicators((previous) => [
                ...next,
                ...(sameDocument
                    ? previous
                        .filter((bar) => !next.some((item) => item.depth === bar.depth))
                        .map((bar) => ({ ...bar, visible: false }))
                    : []),
            ]);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(navigation);
        links.forEach((link) => observer.observe(link));
        return () => observer.disconnect();
    }, [activeId, ancestorIds, ids, expanded]);
    useEffect(() => {
        setExpanded(false);
    }, [ids]);
    useEffect(() => {
        if (!expanded)
            return;
        const closeForEscape = (event) => {
            if (event.key === 'Escape')
                setExpanded(false);
        };
        window.addEventListener('keydown', closeForEscape);
        return () => window.removeEventListener('keydown', closeForEscape);
    }, [expanded]);
    useEffect(() => {
        let frame = 0;
        const update = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
                const tops = new Map(ids.flatMap((id) => {
                    const heading = window.document.getElementById(id);
                    return heading ? [[id, heading.getBoundingClientRect().top]] : [];
                }));
                const scrollingElement = window.document.scrollingElement;
                const threshold = documentTocActivationLine({
                    scrollTop: scrollingElement?.scrollTop ?? window.scrollY,
                    viewportHeight: scrollingElement?.clientHeight ?? window.innerHeight,
                    scrollHeight: scrollingElement?.scrollHeight ??
                        window.document.documentElement.scrollHeight,
                });
                setActiveId(activeDocumentTocId(ids, tops, threshold));
            });
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [ids]);
    useEffect(() => {
        const navigation = navigationRef.current;
        const activeLink = navigation?.querySelector('[aria-current="location"]');
        if (!navigation || !activeLink || navigation.clientHeight === 0)
            return;
        const navigationRect = navigation.getBoundingClientRect();
        const activeRect = activeLink.getBoundingClientRect();
        const top = centeredDocumentTocScrollTop({
            containerHeight: navigation.clientHeight,
            contentHeight: navigation.scrollHeight,
            itemHeight: activeRect.height,
            itemTop: navigation.scrollTop + activeRect.top - navigationRect.top,
        });
        const animation = scrollAnimation.current;
        animation.target = top;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (reducedMotion.matches) {
            window.cancelAnimationFrame(animation.frame);
            animation.frame = 0;
            navigation.scrollTo({ behavior: 'instant', top });
            return;
        }
        if (animation.frame || Math.abs(navigation.scrollTop - top) < 1)
            return;
        animation.position = navigation.scrollTop;
        animation.time = performance.now();
        const tick = (time) => {
            animation.frame = 0;
            if (!navigation.clientHeight)
                return;
            animation.target = Math.max(0, Math.min(animation.target, navigation.scrollHeight - navigation.clientHeight));
            animation.position = reducedMotion.matches
                ? animation.target
                : nextDocumentTocScrollTop(animation.position, animation.target, time - animation.time);
            animation.time = time;
            navigation.scrollTo({ behavior: 'instant', top: animation.position });
            if (animation.position !== animation.target) {
                animation.frame = window.requestAnimationFrame(tick);
            }
        };
        animation.frame = window.requestAnimationFrame(tick);
    }, [activeId, expanded]);
    if (items.length === 0)
        return null;
    return (_jsxs("aside", { className: "document-toc", "data-expanded": expanded || undefined, children: [_jsxs("div", { className: "document-toc-title document-toc-heading", children: [_jsx(TocIcon, {}), _jsx("span", { children: "On This Page" })] }), _jsxs("button", { "aria-controls": "document-table-of-contents", "aria-expanded": expanded, className: "document-toc-title document-toc-toggle", onClick: () => setExpanded((open) => !open), type: "button", children: [_jsx(TocIcon, {}), _jsx("span", { children: "On This Page" }), _jsx("span", { "aria-hidden": "true", className: "document-toc-chevron", children: "\u203A" })] }), _jsxs("nav", { "aria-label": "On This Page", className: "document-toc-list", id: "document-table-of-contents", ref: navigationRef, children: [items.map((item) => {
                        const showGit = gitEnabled && item.hasGitChanges;
                        return (_jsxs("a", { "aria-current": activeId === item.id ? 'location' : undefined, className: "document-toc-link", "data-depth": item.depth, "data-active-group": groupIds.has(item.id) || undefined, "data-active-ancestor": ancestorIds.has(item.id) || undefined, href: `#${encodeURIComponent(item.id)}`, onClick: (event) => {
                                setActiveId(item.id);
                                setExpanded(false);
                                onNavigate(event);
                            }, style: {
                                '--toc-depth': documentTocIndentationDepth(item.depth, minimumSubsectionDepth),
                            }, children: [_jsx("span", { className: "document-toc-link-label", children: item.title }), (showGit || item.errorCount > 0) && (_jsxs("span", { className: "document-toc-states", children: [showGit && (_jsx("span", { "aria-label": "Git changes", className: "document-toc-state git", role: "img", title: "Git changes" })), item.errorCount > 0 && (_jsx("span", { "aria-label": `${item.errorCount} validation ${item.errorCount === 1 ? 'error' : 'errors'}`, className: "document-toc-state error", role: "img", title: `${item.errorCount} validation ${item.errorCount === 1 ? 'error' : 'errors'}` }))] }))] }, item.id));
                    }), indicators.map((bar) => (_jsx("span", { "aria-hidden": "true", className: "document-toc-indicator", style: {
                            '--toc-depth': bar.depth,
                            transform: `translateY(${bar.top}px)`,
                            height: bar.height,
                            opacity: bar.visible ? 1 : 0,
                        } }, bar.depth)))] })] }));
}
