'use client';

import { OramaClient } from '@oramacloud/client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogListItem,
  SearchDialogOverlay,
  type SharedProps,
  TagsList,
  TagsListItem,
} from 'fumadocs-ui/components/dialog/search';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import { useMode } from '@/app/layout.client';
import { useOnChange } from 'fumadocs-core/utils/use-on-change';

const client = new OramaClient({
  endpoint: 'https://cloud.orama.run/v1/indexes/docs-fk97oe',
  api_key: 'oPZjdlFbq5BpR54bV5Vj57RYt83Xosk7',
});

const AISearch = dynamic(() => import('./ai/search'), { ssr: false });

export default function CustomSearchDialog(props: SharedProps) {
  const mode = useMode();
  const [tag, setTag] = useState<string | undefined>(mode);
  const [aiOpen, setAiOpen] = useState(false);
  const { search, setSearch, query } = useDocsSearch({
    type: 'orama-cloud',
    client,
    tag,
  });

  useOnChange(mode, () => {
    if (mode) setTag(mode);
  });

  return (
    <>
      {aiOpen && (
        <AISearch
          open={aiOpen}
          onOpenChange={setAiOpen}
          initialInput={search}
        />
      )}
      <SearchDialog
        search={search}
        onSearchChange={setSearch}
        isLoading={query.isLoading}
        {...props}
      >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        {query.data !== 'empty' && (
          <SearchDialogList
            items={[
              ...(query.data || []),
              ...(search
                ? [
                    {
                      id: '__ai',
                      type: 'page',
                      content: `Ask AI about "${search}"`,
                      url: '#',
                    } as any,
                  ]
                : []),
            ]}
            Item={({ item, onClick }) => {
              if (item.id === '__ai')
                return (
                  <button
                    type="button"
                    className="flex min-h-10 flex-row items-center gap-2.5 rounded-lg px-2 text-start text-sm"
                    onClick={() => setAiOpen(true)}
                  >
                    <Sparkles className="size-4 text-fd-muted-foreground" />
                    <p className="w-0 flex-1 truncate">{item.content}</p>
                  </button>
                );
              return (
                <SearchDialogListItem item={item} onClick={onClick} />
              );
            }}
          />
        )}
        <SearchDialogFooter className="flex flex-row">
          <TagsList tag={tag} onTagChange={setTag} allowClear>
            <TagsListItem value="ui">Framework</TagsListItem>
            <TagsListItem value="headless">Core</TagsListItem>
            <TagsListItem value="mdx">MDX</TagsListItem>
            <TagsListItem value="cli">CLI</TagsListItem>
          </TagsList>
          <a
            href="https://orama.com"
            rel="noreferrer noopener"
            className="ms-auto text-xs text-fd-muted-foreground"
          >
            Search powered by Orama
          </a>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
    </>
  );
}
