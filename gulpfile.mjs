import gulp from "gulp";
import * as dartSass from "sass";
import gulpSass from "gulp-sass";
import fileInclude from "gulp-file-include";
import imagemin from "gulp-imagemin";
import webp from "gulp-webp";
import rename from "gulp-rename";
import autoprefixer from "gulp-autoprefixer";
import plumber from "gulp-plumber";
import fs from "fs-extra";
import path from "path";
import browserSyncModule from "browser-sync";
import { exec } from "child_process";
import fonter from "gulp-fonter";
import ttf2woff from "gulp-ttf2woff";
import ttf2woff2 from "gulp-ttf2woff2";
import { deleteAsync } from "del";
import merge from "merge-stream";
import sourcemaps from "gulp-sourcemaps";
import cleanCSS from "gulp-clean-css";
import htmlmin from "gulp-htmlmin";
import replace from "gulp-replace";

// --- NEW IMPORTS ---
import newer from "gulp-newer";
import gulpEsbuild from "gulp-esbuild";
import versionNumber from "gulp-version-number";

const browserSync = browserSyncModule.create();
const sass = gulpSass(dartSass);

let OUT = "dist"; 

const paths = {
  html: {
    src: "src/*.html",
    dest: () => `${OUT}/`,
  },
  styles: {
    src: "src/scss/main.scss",
    dest: () => `${OUT}/css/`,
  },
  scripts: {
    // Esbuild needs a single entry point to bundle everything
    src: "src/scripts/main.js",
    watch: "src/scripts/**/*.js", // Watch all files for changes
    dest: () => `${OUT}/js/`,
  },
  images: {
    publicFaviconsSrc: "src/public/favicons/**/*",
    publicImagesSrc: "src/public/images/**/*.{png,jpg,jpeg,svg,gif,webp}",
    publicImagesWebpSrc: "src/public/images/**/*.{png,jpg,jpeg}",
    componentsSrc: "src/components/**/images/**/*.{png,jpg,jpeg,svg,gif,webp}",
    componentsWebpSrc: "src/components/**/images/**/*.{png,jpg,jpeg}",
    dest: () => `${OUT}/images/`,
  },
  fonts: {
    srcOtf: "src/fonts/*.otf",
    srcTtf: "src/fonts/*.ttf",
    allSrc: "src/fonts/*.{ttf,otf,woff,woff2}",
    dest: () => `${OUT}/fonts/`,
    scssOut: "src/scss/_fonts.scss"
  },
};

// Helper: write file only if changed
function writeIfChanged(filePath, content) {
  try {
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, "utf8");
      if (existing === content) return false; 
    } else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  } catch (e) {
    try { fs.writeFileSync(filePath, content, "utf8"); return true; } catch (ee) { return false; }
  }
}

// ------------------ SCSS Auto Imports ------------------
export function generateComponentsAuto(done) {
  const componentsDir = "src/components";
  let imports = "";

  function scan(dir) {
    let items = [];
    try { items = fs.readdirSync(dir); } catch (e) { return; }
    for (const item of items) {
      const full = path.join(dir, item);
      let stat;
      try { stat = fs.statSync(full); } catch (e) { continue; }
      if (stat.isDirectory()) scan(full);
      else if (/^_.*\.scss$/.test(item)) {
        const rel = path.relative("src/scss", full).replace(/\\/g, "/");
        const mod = rel.slice(0, -5);
        imports += `@use "${mod}";\n`;
      }
    }
  }

  scan(componentsDir);
  const changed = writeIfChanged("src/scss/_components-auto.scss", imports);
  if (changed) console.log("✅ SCSS components imported (updated).");
  done();
}

// ------------------ Fonts ------------------
const weightMap = {
  "thin": 100, "hairline": 100, "extralight": 200, "extra light": 200, "light": 300,
  "regular": 400, "normal": 400, "medium": 500, "semibold": 600, "semi bold": 600,
  "bold": 700, "extrabold": 800, "extra bold": 800, "black": 900, "heavy": 900
};

function convertOtfToTtf() {
  return gulp.src(paths.fonts.srcOtf, { allowEmpty: true, encoding: false })
  	.pipe(plumber())
  	.pipe(fonter({ formats: ["ttf"] }))
  	.pipe(gulp.dest("src/fonts/"));
}

function convertTtfToWebFonts() {
  const ttf = gulp.src(paths.fonts.srcTtf, { allowEmpty: true, encoding: false }).pipe(plumber());
  return merge(
    ttf.pipe(ttf2woff()).pipe(gulp.dest(paths.fonts.dest())),
    gulp.src(paths.fonts.srcTtf, { allowEmpty: true, encoding: false }).pipe(ttf2woff2()).pipe(gulp.dest(paths.fonts.dest()))
  );
}

export function generateFontsScss(done) {
  const dir = paths.fonts.dest();
  let files = [];
  try { if (fs.existsSync(dir)) files = fs.readdirSync(dir); } catch (e) { files = []; }

  const map = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const filename = path.basename(f, ext);
    if (ext !== '.woff' && ext !== '.woff2') continue;
    if (!map[filename]) map[filename] = { name: filename, woff: null, woff2: null };
    if (ext === ".woff2") map[filename].woff2 = f;
    if (ext === ".woff") map[filename].woff = f;
  }

  let out = "";
  for (const key of Object.keys(map)) {
    const entry = map[key];
    const fullFileName = entry.name;
    let fontFamily = fullFileName;
    let fontWeight = 400;
    let fontStyle = "normal";

    if (fullFileName.includes("-")) {
      const parts = fullFileName.split("-");
      const suffix = parts.pop(); 
      fontFamily = parts.join("-");
      const lowerSuffix = suffix.toLowerCase();
      if (lowerSuffix.includes("italic")) fontStyle = "italic";
      const weightKey = lowerSuffix.replace("italic", "").trim();
      if (weightMap[weightKey]) fontWeight = weightMap[weightKey];
    } else {
      fontFamily = fullFileName;
      if (fontFamily.toLowerCase().includes("italic")) fontStyle = "italic";
    }

    const sources = [];
    if (entry.woff2) sources.push(`url("../fonts/${entry.woff2}") format("woff2")`);
    if (entry.woff) sources.push(`url("../fonts/${entry.woff}") format("woff")`);
    if (sources.length === 0) continue;

    out += `@font-face {
  		font-family: "${fontFamily}";
  		src: ${sources.join(", ")};
  		font-weight: ${fontWeight};
  		font-style: ${fontStyle};
  		font-display: swap;
		}\n\n`;
  }
  writeIfChanged(paths.fonts.scssOut, out);
  done();
}

export const fonts = gulp.series(convertOtfToTtf, convertTtfToWebFonts, generateFontsScss, (done) => { try { browserSync.reload(); } catch (e) {} ; done(); });

// ------------------ Clean ------------------
export async function cleanOut() {
  await deleteAsync([`${OUT}/**`, `!${OUT}`], { force: true });
}
export async function cleanAll() {
  await deleteAsync(["dist/**", "build/**"], { force: true });
}

// ------------------ PATH FIXER ------------------
function resolvePath(url) {
  if (!url) return url;
  if (url.endsWith(".js")) return url;
  if (url.endsWith(".css")) return url;
  if (url.endsWith(".html")) return url;
  if (
    url.startsWith("http") ||
    url.startsWith("//") ||
    url.startsWith("#") ||
    url.startsWith("data:")
  ) return url;

  let clean = url
    .replace(/^(\.\.\/|\.\/)*src\//, "")
    .replace(/^(\.\.\/|\.\/)+/, "");

  if (clean.includes("components/")) {
    let parts = clean.split(/\/|\\/);
    let newParts = parts.filter(p =>
      p !== "components" &&
      p !== "common" &&
      p !== "images"
    );
    return "images/" + newParts.join("/");
  }
  if (clean.includes("public/images/")) {
    return clean.replace("public/images/", "images/public/images/");
  }
  return url;
}

function fixPathsStream() {
  return replace(/(src|href|srcset|url)\s*(=|\()\s*["']?([^"'\)]+)["']?\)?/gi, (match, attr, sep, url) => {
    if (attr.toLowerCase() === 'url') {
      const fixed = resolvePath(url);
      return `url("${fixed}")`;
    }
    const fixed = resolvePath(url);
    const q = match.includes("'") ? "'" : '"';
    return `${attr}=${q}${fixed}${q}`;
  });
}

// ------------------ HTML (Updated with Version Number) ------------------
const versionConfig = {
  'value': '%DT%',
  'append': {
    'key': 'v',
    'to': ['css', 'js'],
  },
};

export function htmlDev() {
  return gulp.src(paths.html.src)
  	.pipe(plumber())
  	.pipe(fileInclude({ prefix: "@@", basepath: "@file" }))
  	.pipe(fixPathsStream())
  	.pipe(gulp.dest(paths.html.dest()))
  	.on("end", () => { try { browserSync.reload(); } catch (e) {} });
}

export function htmlProd() {
  return gulp.src(paths.html.src)
    .pipe(plumber())
    .pipe(fileInclude({ prefix: "@@", basepath: "@file" }))
    .pipe(fixPathsStream())
    .pipe(replace('./js/main.js', './js/main.min.js'))
    .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(versionNumber(versionConfig)) // Cache Busting
    .pipe(gulp.dest(paths.html.dest()))
    .on("end", () => { try { browserSync.reload(); } catch (e) {} });
}

// ------------------ Images (Back to SRC + Dist) ------------------
export function imagesPublicFavicons() {
  return gulp.src(paths.images.publicFaviconsSrc, { allowEmpty: true, encoding: false })
    .pipe(plumber())
    .pipe(newer(path.join(paths.images.dest(), "public/favicons/")))
    .pipe(gulp.dest(path.join(paths.images.dest(), "public/favicons/")))
    .on("end", () => { try { browserSync.reload(); } catch (e) {} });
}

export function imagesPublicImages() {
  return gulp.src(paths.images.publicImagesSrc, { allowEmpty: true, encoding: false })
    .pipe(plumber())
    .pipe(newer(path.join(paths.images.dest(), "public/images/")))
    .pipe(imagemin())
    .pipe(gulp.dest(path.join(paths.images.dest(), "public/images/")))
    .on("end", () => { try { browserSync.reload(); } catch (e) {} });
}

// UPDATED: Generates WebP back to src/public/images AND dist
export function imagesWebpPublicImages() {
  return gulp.src(paths.images.publicImagesWebpSrc, { allowEmpty: true, encoding: false })
    .pipe(plumber())
    .pipe(newer({ dest: "src/public/images", ext: '.webp' }))
    .pipe(webp())
    .pipe(gulp.dest("src/public/images"))
    .pipe(gulp.dest(path.join(paths.images.dest(), "public/images/")))
    .on("end", () => { try { browserSync.reload(); } catch (e) {} });
}

export function imagesComponents() {
  return gulp.src(paths.images.componentsSrc, { allowEmpty: true, base: "src/components", encoding: false })
    .pipe(plumber())
    .pipe(rename(function (filePath) {
      let parts = filePath.dirname.split(/\/|\\/);
      let newParts = parts.filter(part => part !== "common" && part !== "images");
      filePath.dirname = newParts.join("/");
    }))
    .pipe(newer(paths.images.dest()))
    .pipe(imagemin())
    .pipe(gulp.dest(paths.images.dest()))
    .on("end", () => { try { browserSync.reload(); } catch (e) {} });
}

// UPDATED: Generates WebP back to src/components/... AND dist
export function imagesWebpComponents() {
  return gulp.src(paths.images.componentsWebpSrc, { allowEmpty: true, base: "src/components", encoding: false })
    .pipe(plumber())
    .pipe(newer({ dest: "src/components", ext: '.webp' }))
    .pipe(webp())
    .pipe(gulp.dest("src/components"))
    .pipe(rename(function (filePath) {
      let parts = filePath.dirname.split(/\/|\\/);
      let newParts = parts.filter(part => part !== "common" && part !== "images");
      filePath.dirname = newParts.join("/");
    }))
    .pipe(gulp.dest(paths.images.dest()))
    .on("end", () => { try { browserSync.reload(); } catch (e) {} });
}

export const images = gulp.series(
  async () => {
    await fs.ensureDir(paths.images.dest());
    await fs.ensureDir(path.join(paths.images.dest(), "public/images"));
    await fs.ensureDir(path.join(paths.images.dest(), "public/favicons"));
  },
  gulp.parallel(
    imagesPublicFavicons,
    imagesPublicImages,
    imagesWebpPublicImages,
    imagesComponents,
    imagesWebpComponents
  )
);

// ------------------ Scripts (Updated with Esbuild) ------------------
export function scriptsDev() {
  return gulp.src(paths.scripts.src, { allowEmpty: true })
    .pipe(plumber())
    .pipe(gulpEsbuild({
      outfile: 'main.js',
      bundle: true,
      sourcemap: true,
      minify: false,
      platform: 'browser',
    }))
    .pipe(gulp.dest(paths.scripts.dest()))
    .on("end", () => { try { browserSync.reload(); } catch (e) {} });
}

export function scriptsProd() {
  return gulp.src(paths.scripts.src, { allowEmpty: true })
    .pipe(gulpEsbuild({
      outfile: 'main.min.js',
      bundle: true,
      sourcemap: false,
      minify: true,
      platform: 'browser',
    }))
    .pipe(gulp.dest(paths.scripts.dest()))
}

// ------------------ Styles ------------------
export function stylesDev() {
  return gulp.src(paths.styles.src, { allowEmpty: true })
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass({ quietDeps: true }).on("error", sass.logError))
    .pipe(autoprefixer())
    .pipe(fixPathsStream())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(paths.styles.dest()))
    .pipe(browserSync.stream({ match: "**/*.css" }));
}

export function stylesProd() {
  return gulp.src(paths.styles.src, { allowEmpty: true })
    .pipe(plumber())
    .pipe(sass({ quietDeps: true }).on("error", sass.logError))
    .pipe(autoprefixer())
    .pipe(fixPathsStream())
    .pipe(cleanCSS({ level: 2 }))
    .pipe(gulp.dest(paths.styles.dest()))
    .pipe(browserSync.stream({ match: "**/*.css" }));
}

// ------------------ Build Tasks ------------------
export const buildCoreDev = gulp.series(
	cleanOut, 
	generateComponentsAuto, 
	fonts, 
	gulp.parallel(
		htmlDev, 
		stylesDev, 
		scriptsDev, 
		images
	)
);

export const buildCoreProd = gulp.series(
	cleanOut, 
	generateComponentsAuto, 
	fonts, 
	gulp.parallel(
		htmlProd, 
		stylesProd, 
		scriptsProd, 
		images
	)
);

function setOut(target) {
  return function setOutTask(done) { 
		OUT = target; 
		console.log("Output:", OUT); 
		return done(); 
	};
}

export const build = gulp.series(setOut("build"), buildCoreProd);
export const dev = gulp.series(setOut("dist"), buildCoreDev, serve);

// ------------------ Watcher ------------------
export function serve(done) {
  browserSync.init({
    server: { baseDir: `./${OUT}` },
    port: 3000,
    open: true, // FIXED: Opens browser automatically
    notify: false, 
    ui: false
  });

  gulp.watch(["src/*.html", "src/components/**/*.html"], gulp.series(htmlDev));
  gulp.watch(["src/scss/**/*.scss", "!src/scss/_components-auto.scss", "!src/scss/_fonts.scss"], gulp.series(generateComponentsAuto, stylesDev));
  gulp.watch(["src/components/**/*.scss"], gulp.series(generateComponentsAuto, stylesDev));
  
  // Watch all JS, but trigger scriptsDev (which only rebuilds entry point)
  gulp.watch([paths.scripts.watch], gulp.series(scriptsDev));
  
  gulp.watch([paths.images.publicFaviconsSrc, paths.images.publicImagesSrc, paths.images.componentsSrc], gulp.series(images));
  gulp.watch(["src/fonts/*.{ttf,otf}"], gulp.series(fonts));
  done();
}

export default dev;
