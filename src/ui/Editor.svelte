<script lang="ts">
  import { onMount } from 'svelte';
  import { basicSetup, EditorView } from 'codemirror';
  import { yaml } from '@codemirror/lang-yaml';
  import { linter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
  import { Annotation } from '@codemirror/state';
  import { app } from './app-state.svelte';

  const external = Annotation.define<boolean>();
  let host: HTMLDivElement;
  let editor: EditorView | undefined;

  onMount(() => {
    editor = new EditorView({
      doc: app.text,
      parent: host,
      extensions: [
        basicSetup,
        yaml(),
        linter(null),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !u.transactions.some((t) => t.annotation(external))) {
            app.setText(u.state.doc.toString());
          }
        }),
      ],
    });
    return () => editor?.destroy();
  });

  $effect(() => {
    const text = app.text;
    if (editor && text !== editor.state.doc.toString()) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: text },
        annotations: external.of(true),
      });
    }
  });

  $effect(() => {
    const errors = app.view.parseErrors;
    if (!editor) return;
    const doc = editor.state.doc;
    const diagnostics: Diagnostic[] = errors.map((e) => {
      const line = doc.line(Math.min(doc.lines, Math.max(1, e.line)));
      return { from: line.from, to: line.to, severity: 'error', message: e.message };
    });
    editor.dispatch(setDiagnostics(editor.state, diagnostics));
  });
</script>

<div class="editor" data-testid="editor" bind:this={host}></div>

<style>
  .editor { height: 100%; min-height: 0; overflow: hidden; }
  .editor :global(.cm-editor) { height: 100%; }
  .editor :global(.cm-scroller) { overflow: auto; }
</style>
