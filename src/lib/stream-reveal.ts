// The network supplies cumulative text in bursts. Reveal a bounded backlog at
// frame cadence, without adding a second stream or changing the stored response.
export class StreamReveal {
  value = '';
  private target = '';
  get pending() {
    return this.value !== this.target;
  }
  setTarget(text: string, animate: boolean) {
    this.target = text;
    if (!animate || !text.startsWith(this.value)) this.value = text;
  }
  advance(deltaMs: number) {
    if (!this.pending) return this.value;
    const remaining = this.target.length - this.value.length;
    const count = Math.max(
      1,
      Math.ceil(
        ((100 + remaining * 5) * Math.min(Math.max(deltaMs, 0), 50)) / 1000,
      ),
    );
    let end = Math.min(this.target.length, this.value.length + count);
    // Reveal complete math expressions as a unit rather than retypesetting a
    // fraction one character at a time as a burst drains from the buffer.
    for (const match of this.target.matchAll(
      /\$\$[\s\S]*?\$\$|(?<![\\$])\$(?!\$)(?:\\.|[^$\n])+?\$/g,
    )) {
      if (match.index < end && end < match.index + match[0].length) {
        end = match.index + match[0].length;
        break;
      }
    }
    const last = this.target.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff && end < this.target.length) end++;
    this.value = this.target.slice(0, end);
    return this.value;
  }
}
