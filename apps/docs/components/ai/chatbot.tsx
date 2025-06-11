'use client';
import {
	createContext,
	type FormHTMLAttributes,
	type HTMLAttributes,
	type ReactNode,
	type TextareaHTMLAttributes,
	use,
	useEffect,
	useRef,
	useState,
} from 'react';
import { Loader2, RefreshCw, Send, ArrowLeft } from 'lucide-react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { cn } from '@/lib/cn';
import { buttonVariants } from '../ui/button';
// import Link from 'fumadocs-core/link';
import {
	ScrollArea,
	ScrollViewport,
} from 'fumadocs-ui/components/ui/scroll-area';
import { type Message, useChat, type UseChatHelpers } from '@ai-sdk/react';
import type { Processor } from './markdown-processor';

const ChatContext = createContext<UseChatHelpers | null>(null);
function useChatContext() {
	return use(ChatContext)!;
}

function ChatActions() {
	const { messages, status, setMessages, reload } = useChatContext();
	const isLoading = status === 'streaming';
	if (messages.length === 0) return null;
	return (
		<div className="sticky bottom-0 bg-gradient-to-t from-fd-popover px-3 py-1.5 flex flex-row items-center justify-end gap-2 empty:hidden">
			{!isLoading && messages.at(-1)?.role === 'assistant' && (
				<button
					type="button"
					className={cn(buttonVariants({ variant: 'secondary' }), 'text-fd-muted-foreground rounded-full gap-1.5')}
					onClick={() => reload()}
				>
					<RefreshCw className="size-4" />
					Retry
				</button>
			)}
			<button
				type="button"
				className={cn(buttonVariants({ variant: 'secondary' }), 'text-fd-muted-foreground rounded-full')}
				onClick={() => setMessages([])}
			>
				Clear Chat
			</button>
		</div>
	);
}

function ChatInput(props: FormHTMLAttributes<HTMLFormElement>) {
	const { status, input, setInput, handleSubmit, stop } = useChatContext();
	const isLoading = status === 'streaming' || status === 'submitted';
	const onStart = (e?: React.FormEvent) => {
		e?.preventDefault();
		handleSubmit(e);
	};

	useEffect(() => {
		if (isLoading) document.getElementById('nd-ai-input')?.focus();
	}, [isLoading]);

	return (
		<form
			{...props}
			className={cn('flex items-start pe-2 transition-colors', isLoading && 'bg-fd-muted', props.className)}
			onSubmit={onStart}
		>
			<Input
				value={input}
				placeholder={isLoading ? 'AI is answering...' : 'Ask AI something'}
				disabled={status === 'streaming' || status === 'submitted'}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={(event) => {
					if (!event.shiftKey && event.key === 'Enter') {
						onStart();
						event.preventDefault();
					}
				}}
			/>
			{isLoading ? (
				<button
					type="button"
					className={cn(buttonVariants({ variant: 'secondary', className: 'rounded-full mt-2 gap-2' }))}
					onClick={stop}
				>
					<Loader2 className="size-4 animate-spin text-fd-muted-foreground" />
					Abort Answer
				</button>
			) : (
				<button
					type="submit"
					className={cn(buttonVariants({ variant: 'ghost', className: 'rounded-full mt-2 p-1.5' }))}
					disabled={input.length === 0}
				>
					<Send className="size-4" />
				</button>
			)}
		</form>
	);
}

function List(props: Omit<HTMLAttributes<HTMLDivElement>, 'dir'>) {
	const containerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!containerRef.current) return;
		const observer = new ResizeObserver(() => {
			const container = containerRef.current;
			if (!container) return;
			container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
		});
		containerRef.current.scrollTop = containerRef.current.scrollHeight - containerRef.current.clientHeight;
		setTimeout(() => {
			const element = containerRef.current?.firstElementChild;
			if (element) observer.observe(element);
		}, 2000);
		return () => observer.disconnect();
	}, []);
	return (
		<ScrollArea {...props}>
			<ScrollViewport ref={containerRef} className="max-h-[calc(100dvh-240px)] *:!min-w-0 *:!flex *:flex-col">
				{props.children}
			</ScrollViewport>
		</ScrollArea>
	);
}

function Input(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	const ref = useRef<HTMLDivElement>(null);
	const shared = cn('col-start-1 row-start-1 max-h-60 min-h-12 p-3');
	return (
		<div className="grid flex-1">
			<textarea
				id="nd-ai-input"
				className={cn(shared, 'resize-none bg-transparent placeholder:text-fd-muted-foreground focus-visible:outline-none')}
				{...props}
			/>
			<div ref={ref} className={cn(shared, 'break-all invisible')}>{`${props.value?.toString() ?? ''}\n`}</div>
		</div>
	);
}

let processor: Processor | undefined;
const map = new Map<string, ReactNode>();
const roleName: Record<string, string> = { user: 'you', assistant: 'fumadocs' };

function Message({ message }: { message: Message }) {
	return (
		<div>
			<p className={cn('mb-1 text-xs font-medium text-fd-muted-foreground', message.role === 'assistant' && 'text-fd-primary')}>{roleName[message.role] ?? 'unknown'}</p>
			<div className="prose text-sm">
				<Markdown text={message.content} />
			</div>
		</div>
	);
}

function Markdown({ text }: { text: string }) {
	const [currentText, setCurrentText] = useState<string>();
	const [rendered, setRendered] = useState<ReactNode>(map.get(text));
	async function run() {
		const { createProcessor } = await import('./markdown-processor');
		processor ??= createProcessor();
		let result = map.get(text);
		if (!result) {
			result = await processor.process(text, { ...defaultMdxComponents, img: undefined }).catch(() => text);
		}
		map.set(text, result);
		setRendered(result);
	}
	if (text !== currentText) {
		setCurrentText(text);
		void run();
	}
	return rendered ?? text;
}

export interface AIChatProps {
	initialInput?: string;
	onBack?: () => void;
}

export default function AIChat({ initialInput, onBack }: AIChatProps) {
	const chat = useChat({ id: 'search', api: '/api/rag', streamProtocol: 'data', sendExtraMessageFields: true });
	useEffect(() => {
		if (initialInput) chat.setInput(initialInput);
	}, [chat, initialInput]);
	return (
		<ChatContext value={chat}>
			{chat.messages.length > 0 && (
				<List className="bg-fd-popover rounded-xl border shadow-lg">
					<div className="flex flex-col gap-4 p-3 pb-0">
						{chat.messages.map((item, i) => (
							<Message key={i} message={item} />
						))}
					</div>
					<ChatActions />
				</List>
			)}
			<div className="p-2 bg-fd-secondary/50 rounded-xl">
				<div className="rounded-xl overflow-hidden border shadow-lg bg-fd-popover text-fd-popover-foreground">
					<ChatInput />
					<div className="flex items-center gap-2 text-fd-muted-foreground px-3 py-1.5">
						{onBack && (
							<button
								type="button"
								className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }))}
								onClick={onBack}
							>
								<ArrowLeft className="size-4" />
								Back
							</button>
						)}
						<p className="text-xs ms-auto">Powered by OpenAI. Answers may be inaccurate.</p>
					</div>
				</div>
			</div>
		</ChatContext>
	);
}
