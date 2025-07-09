import blessed from "blessed";
import cfonts from "cfonts";

export async function showWelcome(screen) {
  return new Promise((resolve) => {
    const logo = cfonts.render("Orbiton", {
      font: "block",
      colors: ["cyan"],
      background: "transparent",
      letterSpacing: 1,
      lineHeight: 1,
      space: true,
      maxLength: "0",
      env: "node",
    }).string;

    const box = blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      align: "center",
      valign: "middle",
      tags: true,
      style: {
        fg: "cyan",
        bg: "black",
      },
      content: `{bold}${logo}{/bold}\n\nWelcome to Orbiton!`,
    });

    screen.render();

    // 5秒後に自動で閉じるタイマー
    const timer = setTimeout(() => {
      box.destroy();
      screen.render();
      resolve();
    }, 5000);

    // キーが押されたらすぐ閉じる
    screen.onceKey(["q", "escape", "enter", "space", "C-c"], () => {
      clearTimeout(timer);
      box.destroy();
      screen.render();
      resolve();
    });
  });
}
