import blessed from "blessed";
import fetch from "node-fetch";

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
    label: "GitHub User Status",
    tags: true,
    border: { type: "line" },
    style: {
      border: { fg: "cyan" },
      fg: "white",
    },
    scrollable: true,
    alwaysScroll: true,
    padding: { left: 2, right: 2, top: 1, bottom: 1 },
  });

  const { credentials } = options;

  if (!credentials || !credentials.token || !credentials.username) {
    box.setContent(
      "{red-fg}⚠️ GitHub credentials are not set.\n" +
        "Please configure token and username in .orbitonrc.json.{/red-fg}"
    );
    box.screen.render();
    return box;
  }

  async function fetchUserInfo() {
    const userRes = await fetch(
      `https://api.github.com/users/${credentials.username}`,
      {
        headers: {
          Authorization: `token ${credentials.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "orbiton-github-status-plugin",
        },
      }
    );
    if (!userRes.ok)
      throw new Error(`Failed to fetch user info (status: ${userRes.status})`);
    return userRes.json();
  }

  async function fetchUserEvents() {
    const eventsRes = await fetch(
      `https://api.github.com/users/${credentials.username}/events`,
      {
        headers: {
          Authorization: `token ${credentials.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "orbiton-github-status-plugin",
        },
      }
    );
    if (!eventsRes.ok)
      throw new Error(`Failed to fetch events (status: ${eventsRes.status})`);
    return eventsRes.json();
  }

  // Fetch open PRs in user's repos - simplified: get repos then PRs of each (could be heavy)
  async function fetchOpenPRs() {
    // Get repos owned by user (public only)
    const reposRes = await fetch(
      `https://api.github.com/users/${credentials.username}/repos?per_page=50&type=owner&sort=updated`,
      {
        headers: {
          Authorization: `token ${credentials.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "orbiton-github-status-plugin",
        },
      }
    );
    if (!reposRes.ok)
      throw new Error(`Failed to fetch repos (status: ${reposRes.status})`);
    const repos = await reposRes.json();

    // For each repo, fetch open PRs
    // We'll only fetch PRs for first 5 repos to avoid overload
    const prs = [];
    for (const repo of repos.slice(0, 5)) {
      const prsRes = await fetch(
        `https://api.github.com/repos/${credentials.username}/${repo.name}/pulls?state=open&per_page=5`,
        {
          headers: {
            Authorization: `token ${credentials.token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "orbiton-github-status-plugin",
          },
        }
      );
      if (!prsRes.ok) continue; // skip errors per repo
      const repoPRs = await prsRes.json();
      for (const pr of repoPRs) {
        prs.push({
          repo: repo.name,
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          created_at: pr.created_at,
          state: pr.state,
        });
      }
    }
    return prs;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  }

  async function fetchAndFormat() {
    try {
      const [user, events, prs] = await Promise.all([
        fetchUserInfo(),
        fetchUserEvents(),
        fetchOpenPRs(),
      ]);

      const recentEventsCount = Array.isArray(events) ? events.length : 0;
      const profileUrl = user.html_url;

      let content = `{bold}GitHub User Information{/bold}\n\n`;
      content += `Username       : {cyan-fg}${user.login}{/cyan-fg}\n`;
      content += `Name           : {green-fg}${
        user.name || "N/A"
      }{/green-fg}\n`;
      content += `Profile URL    : {underline}${profileUrl}{/underline}\n`;
      content += `Public Repos   : {yellow-fg}${user.public_repos}{/yellow-fg}\n`;
      content += `Followers      : {yellow-fg}${user.followers}{/yellow-fg}\n`;
      content += `Recent Events  : {magenta-fg}${recentEventsCount}{/magenta-fg}\n\n`;

      content += `{bold}Open Pull Requests (up to 5 repos){/bold}\n`;
      if (prs.length === 0) {
        content += "No open pull requests found.\n";
      } else {
        for (const pr of prs.slice(0, 10)) {
          content += `#${pr.number} [${pr.repo}] ${pr.title}\n`;
          content += `  Created at: ${formatDate(pr.created_at)}\n`;
          content += `  URL: ${pr.url}\n\n`;
        }
      }

      content +=
        `\nNote: Contribution graph images are not shown in text UI.\n` +
        `Visit: https://github.com/users/${credentials.username}/contributions`;

      return content;
    } catch (err) {
      return `{red-fg}Failed to fetch data: ${err.message}{/red-fg}`;
    }
  }

  async function updateStatus() {
    const content = await fetchAndFormat();
    box.setContent(content);
    box.screen.render();
  }

  updateStatus();
  const timer = setInterval(
    updateStatus,
    options.updateInterval || 5 * 60 * 1000
  );

  box.on("destroy", () => clearInterval(timer));

  return box;
}
