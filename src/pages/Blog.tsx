import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { POSTS } from "@/content/blog";
import Reveal from "@/components/home/Reveal";
import { ArrowRight } from "lucide-react";

const Blog = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Monkey Trucking Field Notes",
    url: "https://www.monkeytrucking.llc/blog",
    blogPost: POSTS.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `https://www.monkeytrucking.llc/blog/${p.slug}`,
      datePublished: p.datePublished,
      image: `https://www.monkeytrucking.llc${p.cover}`,
    })),
  };

  return (
    <>
      <Seo
        title="Field Notes from the Plant | Monkey Trucking Blog"
        description="Stories from the Kaufman crew: how we run our own material plant, why family ownership matters, and field notes from gravel jobs across DFW."
        path="/blog"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="relative bg-nearblack grain pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <span className="eyebrow">Field Notes</span>
          <h1
            className="font-heading uppercase text-white red-glow mt-4"
            style={{ fontSize: "clamp(44px, 7vw, 96px)", lineHeight: 0.95, letterSpacing: "0.01em" }}
          >
            Stories from the <span className="text-primary">plant</span> and the field.
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mt-6 leading-relaxed">
            How we run, why we built our own material plant, and what we&apos;ve learned hauling
            gravel across Kaufman County and all of DFW since 2010.
          </p>
        </div>
      </section>

      {/* Article grid */}
      <section className="relative bg-nearblack grain pb-32">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            {POSTS.map((post, i) => (
              <Reveal key={post.slug} delay={i * 80}>
                <article className="group h-full flex flex-col">
                  <Link
                    to={`/blog/${post.slug}`}
                    className="relative block overflow-hidden rounded-xl hairline shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
                  >
                    <div className="relative aspect-[16/10]">
                      <img
                        src={post.cover}
                        alt={post.coverAlt}
                        loading="lazy"
                        decoding="async"
                        width="1600"
                        height="1000"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-nearblack via-nearblack/30 to-transparent" />
                    </div>
                  </Link>
                  <div className="pt-6 flex-1 flex flex-col">
                    <div className="text-xs tracking-[0.22em] uppercase text-white/45 mb-3">
                      <time dateTime={post.datePublished}>{post.dateDisplay}</time>
                      <span className="mx-2 text-primary">/</span>
                      Field Notes
                    </div>
                    <h2 className="font-heading uppercase text-white text-2xl sm:text-3xl tracking-wide leading-tight mb-3 transition-colors group-hover:text-primary">
                      <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>
                    <p className="text-white/70 leading-relaxed mb-5 flex-1">{post.excerpt}</p>
                    <Link
                      to={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-2 text-primary font-heading tracking-wider text-sm uppercase hover:gap-3 transition-all"
                    >
                      Read more <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Blog;
