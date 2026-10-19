"""Command line interface.

Usage::

    python -m lsat_tracker serve [--host HOST] [--port PORT] [--reload] [--api-only]
    python -m lsat_tracker parse REPORT.pdf [--json] [--out DIR]
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sys
from dataclasses import asdict
from pathlib import Path

from . import __version__

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8613


def _port_is_free(host: str, port: int) -> bool:
    family = socket.AF_INET6 if ":" in host else socket.AF_INET
    with socket.socket(family, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def _serve(args: argparse.Namespace) -> int:
    import uvicorn

    from .api import API_ONLY_ENV, STATIC_DIR_ENV, resolve_static_dir

    if args.static_dir:
        os.environ[STATIC_DIR_ENV] = str(Path(args.static_dir).resolve())
    if args.api_only:
        os.environ[API_ONLY_ENV] = "1"
    if not _port_is_free(args.host, args.port):
        print(
            f"error: port {args.port} is already in use. Stop the other process or choose "
            f"another port, for example: make run PORT={args.port + 1}",
            file=sys.stderr,
        )
        return 1

    shown_host = "127.0.0.1" if args.host in {"0.0.0.0", "::"} else args.host
    url = f"http://{shown_host}:{args.port}"
    static_dir = resolve_static_dir()
    print(f"\n  LSAT Tracker {__version__}")
    if args.api_only:
        print(f"  API listening on {url}/api (reference at {url}/api/docs)\n", flush=True)
    elif (static_dir / "index.html").is_file():
        print(f"  Open {url} in your browser. Press Ctrl+C to stop.\n", flush=True)
    else:
        print(f"  API listening on {url}/api (web app not built in {static_dir})\n", flush=True)

    uvicorn.run(
        "lsat_tracker.api:create_app",
        factory=True,
        host=args.host,
        port=args.port,
        reload=args.reload,
        reload_dirs=[str(Path(__file__).resolve().parent)] if args.reload else None,
    )
    return 0


def _parse(args: argparse.Namespace) -> int:
    from .parser import ReportParseError, metadata_csv, parse_report, questions_csv

    pdf = Path(args.pdf)
    if not pdf.is_file():
        print(f"error: no such file: {pdf}", file=sys.stderr)
        return 1
    try:
        report = parse_report(
            pdf,
            filename=args.original_name_hint,
            exam_number=args.exam_number,
            exam_date=args.exam_date,
        )
    except ReportParseError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        payload = {
            "metadata": asdict(report.metadata),
            "rows": [asdict(question) for question in report.questions],
        }
        print(json.dumps(payload, indent=2))
        return 0

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    questions_path = out_dir / args.merged_name
    metadata_path = out_dir / args.meta_name
    questions_path.write_text(questions_csv(report), encoding="utf-8", newline="")
    metadata_path.write_text(metadata_csv(report), encoding="utf-8", newline="")
    print(f"Wrote {len(report.questions)} questions:\n - {questions_path}\n - {metadata_path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m lsat_tracker",
        description="Parse LawHub LSAT score reports and serve the LSAT Tracker web app.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    commands = parser.add_subparsers(dest="command", required=True)

    serve = commands.add_parser("serve", help="run the web app and API")
    serve.add_argument(
        "--host",
        default=os.environ.get("HOST", DEFAULT_HOST),
        help="interface to bind (default: %(default)s, this computer only)",
    )
    serve.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", DEFAULT_PORT)),
        help="port to listen on (default: %(default)s)",
    )
    serve.add_argument("--reload", action="store_true", help="restart on code changes")
    serve.add_argument("--static-dir", help="built frontend to serve (default: frontend/dist)")
    serve.add_argument(
        "--api-only",
        action="store_true",
        help="serve only the API, for use with the Vite dev server",
    )
    serve.set_defaults(handler=_serve)

    parse = commands.add_parser("parse", help="parse a score report into CSV or JSON")
    parse.add_argument("pdf", help="path to the score report PDF")
    parse.add_argument("--json", action="store_true", help="print JSON instead of writing CSVs")
    parse.add_argument("--out", default="output_csvs", help="output directory for CSVs")
    parse.add_argument(
        "--merged-name", "--merged_name", dest="merged_name",
        default="all_sections_clean_scored.csv", help="per-question CSV file name",
    )  # fmt: skip
    parse.add_argument(
        "--meta-name", "--meta_name", dest="meta_name",
        default="exam_metadata.csv", help="metadata CSV file name",
    )  # fmt: skip
    parse.add_argument(
        "--original-name-hint", "--original_name_hint", dest="original_name_hint",
        help="original file name used to detect the exam number and date, "
        "for example 'LSAT 141 9_7_2024.pdf'",
    )  # fmt: skip
    parse.add_argument(
        "--exam-number", "--exam_number", dest="exam_number", help="override the exam number"
    )
    parse.add_argument(
        "--exam-date", "--exam_date", dest="exam_date",
        help="override the exam date (YYYY-MM-DD)",
    )  # fmt: skip
    parse.set_defaults(handler=_parse)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.handler(args)


if __name__ == "__main__":
    sys.exit(main())
