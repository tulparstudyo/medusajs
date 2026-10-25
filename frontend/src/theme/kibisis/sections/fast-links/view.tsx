import "./index.css"

export default function FastLinksView({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
