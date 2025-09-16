import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import { createLowlight } from 'lowlight'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import jsLang from 'highlight.js/lib/languages/javascript'
import pyLang from 'highlight.js/lib/languages/python'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'

// Initialize lowlight defensively to avoid crashing the editor on env differences
let lowlight
try {
  lowlight = createLowlight()
  try { lowlight.registerLanguage('javascript', jsLang) } catch {}
  try { lowlight.registerLanguage('python', pyLang) } catch {}
} catch {
  lowlight = undefined
}

export default function RichDetailsEditor({ valueJSON, onUpdateJSON, onUpdatePlain, className }) {
  const safeDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
  // Build extensions progressively; avoid throwing if an optional ext fails
  const extensions = [
    StarterKit.configure({ codeBlock: false }),
    Underline,
    Link.configure({ openOnClick: true, autolink: true }),
    Placeholder.configure({ placeholder: 'Write all additional details, notes, and extended discussion here...' }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ inline: false, allowBase64: true }),
  ]
  try {
    if (lowlight) extensions.push(CodeBlockLowlight.configure({ lowlight }))
  } catch {}
  try {
    extensions.push(
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    )
  } catch {}

  const initialContent = (valueJSON && typeof valueJSON === 'object') ? valueJSON : safeDoc
  const editor = useEditor({
    extensions,
    content: initialContent,
    editorProps: { attributes: { class: 'rich-editor-content' } },
    onUpdate: ({ editor }) => {
      try {
        const json = editor.getJSON()
        const text = editor.getText()
        onUpdateJSON && onUpdateJSON(json)
        onUpdatePlain && onUpdatePlain(text)
      } catch {}
    },
  })

  useEffect(() => {
    if (!editor) return
    if (valueJSON && typeof valueJSON === 'object') {
      try { editor.commands.setContent(valueJSON) } catch {}
    }
  }, [editor])

  if (!editor) return null

  const Button = ({ onClick, label }) => (
    <button className="btn" type="button" onClick={onClick}>{label}</button>
  )

  return (
    <div className={`rich-editor ${className||''}`}>
      <div className="rich-toolbar">
        <Button label="H1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <Button label="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Button label="H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <Button label="B" onClick={() => editor.chain().focus().toggleBold().run()} />
        <Button label="I" onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Button label="U" onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <Button label="S" onClick={() => editor.chain().focus().toggleStrike().run()} />
        <Button label="Code" onClick={() => editor.chain().focus().toggleCode().run()} />
        <Button label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Button label="HR" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <Button label="UL" onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Button label="OL" onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Button label="Task" onClick={() => editor.chain().focus().toggleTaskList().run()} />
        <Button label="CodeBlock" onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <Button label="Table" onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()} />
        <Button label="Clear" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
