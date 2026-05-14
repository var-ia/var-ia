FROM oven/bun:1
RUN bun install -g @var-ia/cli
ENTRYPOINT ["wikihistory"]
CMD ["analyze", "Bitcoin", "--depth", "quick"]
