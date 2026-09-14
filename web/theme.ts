const themeButtons =
  document.querySelectorAll<HTMLButtonElement>('button[data-theme]');
function updateThemeButtons() {
  for (const button of themeButtons) {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.theme === document.documentElement.dataset.theme)
    );
  }
}
for (const button of themeButtons) {
  button.addEventListener('click', () => {
    const theme = button.dataset.theme!;
    document.documentElement.dataset.theme = theme;
    updateThemeButtons();
    try {
      localStorage.setItem('isocube-theme', theme);
    } catch {
      // Theme switching still works when browser storage is unavailable.
    }
  });
}
updateThemeButtons();
