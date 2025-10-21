export function youtubeEmbed(idOrUrl: string): string {
  const id = idOrUrl.replace(/^.*v=|^.*youtu\.be\//, '').slice(0, 11);
  return `https://www.youtube.com/embed/${id}`;
}
export default youtubeEmbed;




