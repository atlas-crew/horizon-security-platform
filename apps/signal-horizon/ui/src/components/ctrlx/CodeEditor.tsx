import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { clsx } from 'clsx';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'json' | 'sql';
  height?: string;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = 'json',
  height = '300px',
  className,
  readOnly = false,
  placeholder,
}: CodeEditorProps) {
  const extensions = [
    language === 'json' ? json() : sql()
  ];

  return (
    <div className={clsx('border border-border-subtle overflow-hidden rounded-sm', className)}>
      <CodeMirror
        value={value}
        height={height}
        theme={vscodeDark}
        extensions={extensions}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  );
}
