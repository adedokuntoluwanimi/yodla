import test from "node:test";
import assert from "node:assert/strict";
import { BLOG_POSTS, getBlogPost } from "../js/blogs.js";

test("journal stories have distinct routes and complete readable content", () => {
  assert.equal(BLOG_POSTS.length, 3);
  assert.equal(new Set(BLOG_POSTS.map(({ id }) => id)).size, BLOG_POSTS.length);
  for (const post of BLOG_POSTS) {
    assert.ok(post.title.length > 20);
    assert.ok(post.introduction.length > 40);
    assert.equal(post.sections.length, 3);
    assert.equal(getBlogPost(post.id), post);
  }
});
