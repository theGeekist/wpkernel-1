import {
	buildWpPostFormPolicy,
	type WpPostStorage,
} from '../wp-post-form-policy';

describe('wp-post form policy', () => {
	it('classifies canonical, meta, and taxonomy fields once', () => {
		const storage: WpPostStorage = {
			mode: 'wp-post',
			supports: ['title', 'editor'],
			meta: {
				title: { type: 'string' },
				status: { type: 'string' },
				rating: { type: 'number' },
			},
			taxonomies: {
				rating: { taxonomy: 'rating_topic' },
				departments: { taxonomy: 'acme_department' },
			},
		};

		const policy = buildWpPostFormPolicy(storage, 'PostFormInput');

		expect(policy.inputFieldLines).toEqual([
			'title?: string;',
			'content?: string;',
			'status?: string;',
			'rating?: number;',
			'departments?: number; // Single select for now',
		]);
		expect(policy.defaultValueLines).toEqual([
			"title: '',",
			"content: '',",
			'status: undefined,',
			'rating: undefined,',
			'departments: undefined,',
		]);
		expect(policy.payloadLines).toContain(
			'if (input.status !== undefined) meta.status = input.status;'
		);
		expect(policy.payloadLines).not.toContain(
			'if (input.status) payload.status = input.status;'
		);
		expect(policy.fieldDefinitionLines).toContain(
			"selectField<PostFormInput>('departments', departmentsOptions.options, { label: 'Department', edit: 'select' }),"
		);
	});

	it('renders arbitrary data keys with collision-free bindings', () => {
		const storage: WpPostStorage = {
			mode: 'wp-post',
			meta: {
				"seo'title": { type: 'string' },
				['__proto__']: { type: 'string' },
			},
			taxonomies: {
				'book-genre': { taxonomy: 'book_genre' },
				'book genre': { taxonomy: 'book_topic' },
				'123': { taxonomy: 'numeric_topic' },
			},
		};

		const policy = buildWpPostFormPolicy(storage, 'PostFormInput');

		expect(policy.inputFieldLines).toContain("'seo\\'title'?: string;");
		expect(policy.defaultValueLines).toContain("['__proto__']: undefined,");
		expect(policy.payloadLines).toContain(
			"if (input['__proto__'] !== undefined) Object.defineProperty(meta, '__proto__', { configurable: true, enumerable: true, value: input['__proto__'], writable: true });"
		);
		expect(policy.taxonomyHookLines).toEqual([
			"const taxonomy123Options = useTaxonomyOptions('numeric-topic.list');",
			"const bookGenreOptions = useTaxonomyOptions('book-genre.list');",
			"const bookGenreOptions2 = useTaxonomyOptions('book-topic.list');",
		]);
		expect(policy.fieldDependencyLines).toEqual([
			'taxonomy123Options.options,',
			'bookGenreOptions.options,',
			'bookGenreOptions2.options,',
		]);
	});
});
