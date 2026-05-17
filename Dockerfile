FROM oven/bun:1.3.14
RUN bun install -g @refract-org/cli
ENTRYPOINT ["wikihistory"]
CMD ["analyze", "Bitcoin", "--depth", "brief"]
