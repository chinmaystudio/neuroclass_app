/** @type {const} */
// Aligned 1:1 with the NeuroClass web design tokens in
// chinmaystudio/neuroclass `frontend/index.css` (--nc-*), so the mobile app
// shares the web interface's identity: Google blue primary, the same
// neutrals, and the same status colours in light and dark mode.
// Web warning fill is #f9ab00 with ink #8a5300; #b06000 is the readable
// text-safe step of that same hue used for the mobile warning token.
const themeColors = {
  primary: { light: "#1a73e8", dark: "#8ab4f8" },
  background: { light: "#f8fafd", dark: "#121314" },
  surface: { light: "#FFFFFF", dark: "#1e1f22" },
  foreground: { light: "#202124", dark: "#e8eaed" },
  muted: { light: "#5f6368", dark: "#bdc1c6" },
  border: { light: "#dadce0", dark: "#3c4043" },
  success: { light: "#188038", dark: "#81c995" },
  warning: { light: "#b06000", dark: "#fdd663" },
  error: { light: "#d93025", dark: "#f28b82" },
};

module.exports = { themeColors };
