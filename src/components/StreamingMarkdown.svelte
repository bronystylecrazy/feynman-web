<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import Markdown from './Markdown.svelte';
  import { StreamReveal } from '../lib/stream-reveal';
  import { motion } from '../lib/motion';
  let {
    content,
    streaming = false,
    animate = false,
    workspacePath,
    onreveal,
  }: {
    content: string;
    streaming?: boolean;
    animate?: boolean;
    workspacePath?: string;
    onreveal?: () => void;
  } = $props();
  const reveal = new StreamReveal();
  let visible = $state('');
  let revealing = $state(false);
  let frame = 0;
  let lastTime = 0;
  function advance(time: number) {
    frame = 0;
    if (!motion(1)) reveal.setTarget(content, false);
    visible = reveal.advance(lastTime ? time - lastTime : 16);
    lastTime = time;
    revealing = reveal.pending;
    onreveal?.();
    if (reveal.pending) frame = requestAnimationFrame(advance);
    else lastTime = 0;
  }
  $effect(() => {
    const target = content;
    const smooth = animate && motion(1) > 0;
    untrack(() => {
      reveal.setTarget(target, smooth);
      visible = reveal.value;
      revealing = reveal.pending;
      if (reveal.pending && !frame) frame = requestAnimationFrame(advance);
    });
  });
  onDestroy(() => {
    if (frame) cancelAnimationFrame(frame);
  });
</script>

<div class="streaming-answer" aria-busy={streaming || revealing}>
  <Markdown
    content={visible}
    streaming={streaming || revealing}
    {workspacePath}
  />
</div>
