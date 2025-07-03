declare module 'react-draft-wysiwyg' {
  import { ComponentType } from 'react';
  import { EditorState } from 'draft-js';

  export interface EditorProps {
    editorState?: EditorState;
    onEditorStateChange?: (editorState: EditorState) => void;
    toolbar?: any;
    editorStyle?: React.CSSProperties;
    toolbarStyle?: React.CSSProperties;
    ref?: React.Ref<any>;
    [key: string]: any;
  }

  export const Editor: ComponentType<EditorProps>;
}

declare module 'draft-js' {
  export class EditorState {
    static createEmpty(): EditorState;
    static createWithContent(contentState: ContentState): EditorState;
    getCurrentContent(): ContentState;
  }

  export class ContentState {
    static createFromBlockArray(contentBlocks: any[]): ContentState;
  }

  export function convertToRaw(contentState: ContentState): any;
}

declare module 'draftjs-to-html' {
  function draftToHtml(rawContentState: any): string;
  export default draftToHtml;
}

declare module 'html-to-draftjs' {
  interface ConvertedContent {
    contentBlocks: any[];
    entityMap: any;
  }
  
  function htmlToDraft(html: string): ConvertedContent | null;
  export default htmlToDraft;
} 