#!/usr/bin/env bash
# Legacy CLI wrapper — maps old documented flags to actual wikihistory CLI
# Usage: source this file, then call legacy functions, or run directly:
#   bash legacy-cli-wrappers.sh analyze --page "Earth" --limit 50 --output ./events.json
#
# These wrappers translate pre-v0.3 CLI patterns to the current interface.

set -euo pipefail

die() { echo "Error: $*" >&2; exit 1; }
warn() { echo "Warning: $*" >&2; }

# ── analyze: --page X --limit N --output file.json → wikihistory analyze "X" [opts] ──
legacy_analyze() {
  local page="" depth="detailed" from="" to="" since=""
  local cache=""
  local model="" api="" pages_file="" router=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --page)       page="$2"; shift 2 ;;
      --wiki)       api="https://$2/api.php"; shift 2 ;;
      --limit)
        warn "--limit is not a real flag; use --from and --to for revision ranges. Ignoring --limit."
        shift 2 ;;
      --output)
        warn "--output is not a real flag. Pipe or redirect stdout, or use 'wikihistory export $page > $2'."
        shift 2 ;;
      --format)
        warn "--format on analyze is not real. To specify format, use 'wikihistory export $page --format $2'."
        shift 2 ;;
      --delay)
        warn "--delay is not a real flag. The CLI handles rate limiting internally. Ignoring --delay."
        shift 2 ;;
      --depth)      depth="$2"; shift 2 ;;
      --from)       from="$2"; shift 2 ;;
      --to)         to="$2"; shift 2 ;;
      --since)      since="$2"; shift 2 ;;
      --cache|-c)   cache="-c"; shift ;;
      --model|-m)   model="-m $2"; shift 2 ;;
      --api)        api="$2"; shift 2 ;;
      --pages-file) pages_file="$2"; shift 2 ;;
      --router)     router="--router"; shift ;;
      --before|--after|--config|--type|--input)
        warn "$1 is not a real flag. Ignoring."; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$page" ]]; then
    die "page title required: legacy_analyze --page <title>"
  fi

  local cmd="wikihistory analyze \"$page\""
  [[ -n "$depth" && "$depth" != "detailed" ]] && cmd="$cmd --depth $depth"
  [[ -n "$from" ]] && cmd="$cmd --from $from"
  [[ -n "$to" ]] && cmd="$cmd --to $to"
  [[ -n "$since" ]] && cmd="$cmd --since $since"
  [[ -n "$cache" ]] && cmd="$cmd $cache"
  [[ -n "$model" ]] && cmd="$cmd $model"
  [[ -n "$api" ]] && cmd="$cmd --api $api"
  [[ -n "$pages_file" ]] && cmd="$cmd --pages-file $pages_file"
  [[ -n "$router" ]] && cmd="$cmd $router"

  echo "→ $cmd"
  eval "$cmd"
}

# ── claim: --input file.json --output file.json --type X → wikihistory claim <page> -t <text> ──
legacy_claim() {
  local page="" text="" cache="" model="" api=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --page)       page="$2"; shift 2 ;;
      --text|-t)    text="$2"; shift 2 ;;
      --input)
        warn "--input is not a real flag. 'wikihistory claim' takes a page and --text directly."
        shift 2 ;;
      --output)
        warn "--output is not a real flag. Pipe stdout to a file instead."; shift 2 ;;
      --type)
        warn "--type is not a real flag. 'wikihistory claim' tracks one claim by --text."; shift 2 ;;
      --cache|-c)   cache="-c"; shift ;;
      --model|-m)   model="-m $2"; shift 2 ;;
      --api)        api="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$page" ]]; then
    die "page title required: legacy_claim --page <title> -t <text>"
  fi
  if [[ -z "$text" ]]; then
    die "claim text required: legacy_claim --page <title> -t <text>"
  fi

  local cmd="wikihistory claim \"$page\" --text \"$text\""
  [[ -n "$cache" ]] && cmd="$cmd $cache"
  [[ -n "$model" ]] && cmd="$cmd $model"
  [[ -n "$api" ]] && cmd="$cmd --api $api"

  echo "→ $cmd"
  eval "$cmd"
}

# ── export: --input file.json --format csv --output file.csv → wikihistory export <page> --format csv ──
legacy_export() {
  local page="" format="json" bundle="" api="" model=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --page)       page="$2"; shift 2 ;;
      --input)
        warn "--input is not a real flag. 'wikihistory export' takes a page title and fetches/analyzes live."
        shift 2 ;;
      --format|-f)  format="$2"; shift 2 ;;
      --output)
        warn "--output is not a real flag. Redirect stdout: wikihistory export \"$page\" > file"; shift 2 ;;
      --bundle)     bundle="--bundle"; shift ;;
      --manifest)   bundle="--manifest"; shift ;;
      --model|-m)   model="-m $2"; shift 2 ;;
      --api)        api="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$page" ]]; then
    die "page title required: legacy_export --page <title>"
  fi

  local cmd="wikihistory export \"$page\" --format $format"
  [[ -n "$bundle" ]] && cmd="$cmd $bundle"
  [[ -n "$model" ]] && cmd="$cmd $model"
  [[ -n "$api" ]] && cmd="$cmd --api $api"

  echo "→ $cmd"
  eval "$cmd"
}

# ── visualize: --input file.json --output file.html → wikihistory visualize <page> --format mermaid ──
legacy_visualize() {
  local page="" format="mermaid" all="" api=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --page)       page="$2"; shift 2 ;;
      --input)
        warn "--input is not a real flag. 'wikihistory visualize' re-fetches and analyzes from the live wiki."
        shift 2 ;;
      --output)
        warn "--output is not a real flag. Redirect stdout: wikihistory visualize \"$page\" > file"; shift 2 ;;
      --format|-f)  format="$2"; shift 2 ;;
      --all)        all="--all"; shift ;;
      --api)        api="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$page" ]]; then
    die "page title required: legacy_visualize --page <title>"
  fi

  local cmd="wikihistory visualize \"$page\""
  [[ -n "$format" && "$format" != "mermaid" ]] && cmd="$cmd --format $format"
  [[ -n "$all" ]] && cmd="$cmd $all"
  [[ -n "$api" ]] && cmd="$cmd --api $api"

  echo "→ $cmd"
  eval "$cmd"
}

# ── watch: --page X --interval N --wiki Y → wikihistory watch "X" --interval N ──
legacy_watch() {
  local page="" interval="" section="" api=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --page)       page="$2"; shift 2 ;;
      --wiki)       api="https://$2/api.php"; shift 2 ;;
      --interval)
        # Old docs used seconds, real CLI uses ms
        local raw="$2"
        if [[ "$raw" =~ ^[0-9]+$ ]] && [[ "$raw" -lt 1000 ]]; then
          interval=$((raw * 1000))
        else
          interval="$raw"
        fi
        shift 2 ;;
      --section|-s) section="-s $2"; shift 2 ;;
      --api)        api="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$page" ]]; then
    die "page title required: legacy_watch --page <title>"
  fi

  local cmd="wikihistory watch \"$page\""
  [[ -n "$interval" ]] && cmd="$cmd --interval $interval"
  [[ -n "$section" ]] && cmd="$cmd $section"
  [[ -n "$api" ]] && cmd="$cmd --api $api"

  echo "→ $cmd"
  eval "$cmd"
}

# ── cron: --config cronfile --db path → wikihistory cron <pages-file> ──
legacy_cron() {
  local pages_file="" interval="" api="" slack="" email="" webhook=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --config)
        # --config cronfile → use as pages-file
        pages_file="$2"; shift 2 ;;
      --db)
        warn "--db is not a real flag. Use --cache-dir for cache location, or 'wikihistory analyze -c' for caching."
        shift 2 ;;
      --interval|-i) interval="-i $2"; shift 2 ;;
      --notify-slack)     slack="--notify-slack"; shift ;;
      --notify-email)     email="--notify-email"; shift ;;
      --notify-webhook)   webhook="--notify-webhook $2"; shift 2 ;;
      --api)        api="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$pages_file" ]]; then
    die "pages file required: legacy_cron --config <pages-file>"
  fi

  local cmd="wikihistory cron \"$pages_file\""
  [[ -n "$interval" ]] && cmd="$cmd $interval"
  [[ -n "$slack" ]] && cmd="$cmd $slack"
  [[ -n "$email" ]] && cmd="$cmd $email"
  [[ -n "$webhook" ]] && cmd="$cmd $webhook"
  [[ -n "$api" ]] && cmd="$cmd --api $api"

  echo "→ $cmd"
  eval "$cmd"
}

# ── diff: --before file1.json --after file2.json → wikihistory diff <topic> --wiki-a URL --wiki-b URL ──
legacy_diff() {
  local topic="" wiki_a="" wiki_b="" wiki_c="" depth="detailed" model=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --before)
        warn "--before/--after compare is not real. Use --wiki-a and --wiki-b to diff the same topic across wikis."
        shift 2 ;;
      --after)      shift 2 ;;
      --topic)      topic="$2"; shift 2 ;;
      --wiki-a)     wiki_a="$2"; shift 2 ;;
      --wiki-b)     wiki_b="$2"; shift 2 ;;
      --wiki-c)     wiki_c="$2"; shift 2 ;;
      --depth|-d)   depth="$2"; shift 2 ;;
      --model|-m)   model="-m $2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$topic" ]]; then
    die "topic required: legacy_diff --topic <title> --wiki-a <url> --wiki-b <url>"
  fi
  if [[ -z "$wiki_a" || -z "$wiki_b" ]]; then
    die "--wiki-a and --wiki-b are required"
  fi

  local cmd="wikihistory diff \"$topic\" --wiki-a \"$wiki_a\" --wiki-b \"$wiki_b\""
  [[ -n "$wiki_c" ]] && cmd="$cmd --wiki-c \"$wiki_c\""
  [[ -n "$depth" && "$depth" != "detailed" ]] && cmd="$cmd --depth $depth"
  [[ -n "$model" ]] && cmd="$cmd $model"

  echo "→ $cmd"
  eval "$cmd"
}

# ── eval: --input events --ground-truth file → wikihistory eval --ground-truth path ──
legacy_eval() {
  local page="" ground_truth="" l2="" model=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --input)
        warn "--input is not a real flag. 'wikihistory eval' uses its own benchmark dataset."
        shift 2 ;;
      --page)       page="$2"; shift 2 ;;
      --ground-truth) ground_truth="$2"; shift 2 ;;
      --l2)         l2="--l2"; shift ;;
      --model|-m)   model="-m $2"; shift 2 ;;
      *) shift ;;
    esac
  done

  local cmd="wikihistory eval"
  [[ -n "$page" ]] && cmd="$cmd --page \"$page\""
  [[ -n "$ground_truth" ]] && cmd="$cmd --ground-truth \"$ground_truth\""
  [[ -n "$l2" ]] && cmd="$cmd $l2"
  [[ -n "$model" ]] && cmd="$cmd $model"

  echo "→ $cmd"
  eval "$cmd"
}

# ── Top-level dispatch (for direct invocation: bash legacy-cli-wrappers.sh <command> ...) ──
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -eq 0 ]]; then
    echo "Usage: bash legacy-cli-wrappers.sh <command> [args...]"
    echo ""
    echo "Commands (legacy wrappers):"
    echo "  analyze     translate old --page --limit --output flags"
    echo "  claim       translate old --input --output --type flags"
    echo "  export      translate old --input --format --output flags"
    echo "  visualize   translate old --input --output flags"
    echo "  watch       translate old --page --interval(s) --wiki flags"
    echo "  cron        translate old --config --db flags"
    echo "  diff        translate old --before --after flags"
    echo "  eval        translate old --input --ground-truth flags"
    echo ""
    echo "Source this file to use functions directly:"
    echo "  source legacy-cli-wrappers.sh"
    echo "  legacy_analyze --page 'Earth' --limit 50"
    exit 0
  fi

  cmd="$1"; shift
  case "$cmd" in
    analyze)   legacy_analyze "$@" ;;
    claim)     legacy_claim "$@" ;;
    export)    legacy_export "$@" ;;
    visualize) legacy_visualize "$@" ;;
    watch)     legacy_watch "$@" ;;
    cron)      legacy_cron "$@" ;;
    diff)      legacy_diff "$@" ;;
    eval)      legacy_eval "$@" ;;
    *)
      echo "Unknown command: $cmd"
      echo "Available: analyze claim export visualize watch cron diff eval"
      exit 1 ;;
  esac
fi
