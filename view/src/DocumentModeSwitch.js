import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function DocumentModeSwitch({ mode, onChange, }) {
    return (_jsx("div", { "aria-label": "Document presentation", className: "document-mode-switch", role: "group", children: ['view', 'edit'].map((value) => (_jsxs("button", { "aria-pressed": mode === value, onClick: () => onChange(value), type: "button", children: [value === 'edit' && (_jsxs("svg", { "aria-hidden": "true", viewBox: "0 0 14 14", children: [_jsx("path", { d: "m3 10.8.5-2.5 5.8-5.8 1.4 1.4-5.8 5.8-2.9.1Z" }), _jsx("path", { d: "m8.5 3.3 1.4 1.4" })] })), _jsx("span", { children: value === 'view' ? 'View' : 'Edit' })] }, value))) }));
}
