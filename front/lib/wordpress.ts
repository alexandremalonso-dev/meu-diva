// C:\meu-diva\front\lib\wordpress.ts

const WP_API_URL = 'https://meudivaonline.com/wp-json/wp/v2';

export async function getPage(slug: string) {
  const res = await fetch(`${WP_API_URL}/pages?slug=${slug}&_fields=id,title,content,acf`);
  const pages = await res.json();
  return pages[0] || null;
}

export async function getPosts() {
  const res = await fetch(`${WP_API_URL}/posts?_embed&per_page=10`);
  return res.json();
}

export async function getPost(slug: string) {
  const res = await fetch(`${WP_API_URL}/posts?slug=${slug}&_embed`);
  const posts = await res.json();
  return posts[0] || null;
}