FROM oven/bun:1.3.14
RUN bun install -g @var-ia/cli
ENTRYPOINT ["wikihistory"]
CMD ["analyze", "Bitcoin", "--depth", "brief"]
