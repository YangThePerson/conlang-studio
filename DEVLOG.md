# Dev Log

## The Road to a Fully Deployed App

### Day 1

**Shipped:** Initial setup for App (Conlang App (Working Title)) Auth with Clerk, DB, hosting on Neon, Drizzle for the ORM, Zod for validation.

Repo: https://github.com/YangThePerson/conlang-app.

Deployed: https://conlang-app.vercel.app/.

**Learned:** The basic setup for Zod and Drizzle schemas is not far off from how SQL tables are written, so that all translates well enough.

The actual schema creation via z.object for validation though is something I also don't get. The setup for the middleware and client auth also looks very opaque.

Claude Code has been helpful in filling in the gaps. I recognize that being comfortable with AI tools is part of the end goal, but code that is not mine being used for a part that I find opaque is dangerous.

### Day 2

**Shipped:** Added documentation to the codebase. It is all very small right now, but this is a thing that has killed off my projects in the past, so it is best to not let it grow without comments.

**Learned:** Actually studied up on schemas and validations. The actual schema definitions are effectively just a different way of writing SQL tables. The validations just ensure that the input from a Request fits the correct shape.

### Day 3

**Shipped:** Wrote `CLAUDE.md` to ensure specific writing conventions and adherence to project structure as well as informing CC by default about the breaking change from `middleware.ts` to `proxy.ts` (AI is somehow always skeptical about this one, so it is best to specify it from the start).

Wrote route `GET()`, `POST()`, `DELETE()`, and `PATCH()` using the schema validation.

**Learned:** Learned more on auth Middleware. The current model has every route except the root and signin/sign-up pages set to protected by default. This setup seems sensible for the purposes of this app, so I will not be changing it. Clerk does not immediately amend the users table in Neon and needs to either eagerly do it through webhooks or lazily through `currentUser()`. The current choice is lazy loading since the setup is simpler and I do not expect it to become a problem as long as we always get users through the same pipeline.

### Day 4

**Shipped:** Added languages route + server actions. Refactored HTTP endpoints to match actions and move logic to a separate service layer. All Requests, both from API and from server actions will run validation, and send the valid input to the service layer. There is currently no additional plans to use the API anywhere, but this method means that future plans past the exact scope of this app will not require significant refactoring.

Amended `CLAUDE.md` to adhere to this new model.

**Learned:** Server actions are, despite their initial appearance, very exposed. Validation needs to run separately within them, otherwise, it becomes a security risk (irrelevant to this project, but likely good practice anyways). Validation now also needs to handle UUIDs. In the HTTP endpoints, that is handled through params, but here, we need an additional check against `z.uuid()`.

### Day 5

**Shipped:** Set up skeleton for language editor + sub-routes. Sub-route navigation works through side bar in a nested `layout.tsx`.

**Learned:** A lot of how Next.js works really seems to be about the way you structure your files. It is, in a way, less clear how it works immediately with pages and layouts, but the payoff seems to come from how immediately it all slots in.

First actual bit of trying to fiddle with Tailwind. The core principle that each class is just one rule makes enough sense; it is just a matter of even knowing how to write them and managing to not misspell them. At the very least, their actual function is obvious at a glance, but I do find them harder to debug in the browser.

### Day 6

**Shipped:** Began working on the Phoneme subroute. Added basic form for adding new phonemes to language. Decided to have separate fields for symbol and optional IPA notation — making for what may be the first of many updates to the schema, but best to do it with a simple column addition first before trying it with anything more complex. The initial code for the subroute was made by CC, but the actual updates to the schema were done by hand. I look through it, follow it to see that it works, and make edits where needed. Its handling of the service layer is fine, but its frontend work is ugly, but I should treat that as a chance to familiarize myself further with Tailwind. I realize that it is also less willing to rearrange things than I would be. Importing Result<T> from languages to phonemes does not sit right with me.

**Learned:** First time using `drizzle-kit push`. The usage itself is simple enough and I confirmed in Neon that the table got updated correctly. Although I recognize that having to update the schema is a common thing, the refactoring is not especially pleasant. Future projects will have more thought put into exactly how the structures are laid out to minimize this. Looking further at straight pushing vs migrations, I see that migrations are better for a production environment and allow for actual tracking. A simple push was right here since I was only adding a column, but, when I get to syllables, a proper migration might be necessary to be better able to keep track of the exact change.

On a side note, I am finding that I actually have no clue of when to mark checkboxes in the roadmap. I feel as though I was overly eager to do so at the start, but am rapidly becoming more conservative regarding them. There are arguments to be made for error handling and input validation, but I feel as though checking those off should wait until those skills run into a more significant test.

### Day 7

**Shipped:** Worked more on the phoneme subroute. A user is now officially able to make a language and set up a list of phonemes with symbols, weights, and optional IPA notation. The phoneme list also allows for editing and deleting phonemes. No further functionality exists yet. Did some heavy editing to the phoneme rows and form made by CC also to make it look better. The addition and editing forms look nigh identical, so a minor future refactor might just be to fold them into one.

Minor point, but I also ended up moving the Results type to its own file. Also intending to add an 'Svc' suffix to all service layer functions for the sake of not confusing them with server actions that happen to have similar names.

**Learned:** Getting more comfortable with Tailwind. Not enough so that I'd label myself as proficient, but I am finding it readable. The biggest obstacle is actually my own CSS skill. Knowing the language and being good at it are two fundamentally different skills and I am definitely not a graphic designer.

### Day 8

**Shipped:** Worked further on the phoneme form. Merged the adding and editing forms into one reusable component. Began planning how to manage groups. Being able to properly use AI tools is a part of the experience here, but I would like to take a good crack at it myself first without any scaffolding to ensure I understand what I'm doing.

**Learned:** Editing used to work with `useTransition()` and adding used `useActionState()`, so folding the forms together ended up needed refactoring for the server actions. This was almost definitely more trouble than it was worth. Groups handling initially looked daunting because it is so different from how it'd be handled in a purely frontend app. Looking at it again, I am realizing the schema kind of solves that problem already. The memberships table is the whole thing.

### Day 9

**Shipped:** Began working on the phoneme groups section. I attempted to write the actions by hand and quickly found that my methods are inefficient and convoluted. This is the use case for the relations in the schema, but I am not familiar enough with this to know how to use them right. I can wire it up to query the db for all the requisite fields and compose them together through mapping and filtering (how I miss you, list comprehension), but then the logic is either happening in the components or in an otherwise needlessly convoluted Svc function. Regardless, the page is now loading the right data and the forms and actions are ready to get written.

**Learned:** I see that querying the db for group relationships is more complicated than expected. The args for `findMany()` use a where and with prop. The where is seemingly the same check you would do when using select. The with is the part I don't quite get. I know that it gets it from the relations in the schema, but I wouldn't know how to explain it or how to write it myself. The experiment of trying to avoid AI code wholesale for this section has readily failed, but at least exposed a specific gap I need to fill.

### Day 10

**Shipped:** Wrote further Svc functions for `phoneme_groups` and `group_memberships`. Actions and components are still missing, but once hooked up, users will be able to create, delete, and change the names of groups as well as add and remove phonemes from the group. Because `group_memberships` is an entirely relational table, rows are only ever added or removed, but never edited. These functions I did mostly write by hand. I attempted to use the `with` for IDOR validation when creating memberships, but that turned out to be worse here than just making a few trips to the db — still though, the big win here is the actual usage of the relations rather than whether or not the implementation was correct for the given situation. The goal here is to make code that I can explain.

**Learned:** Here's an attempt at understanding the nested `with` in `lib/phoneme-groups.ts`. Querying phoneme_groups with `findMany()` first takes a where that matches the language id. That part already made sense and is identical to how it is handled in `db.select()`. The `with` is first using the `phonemeGroupsRelations` defined in the schema, which takes `phoneme_groups` as its first argument. The memberships listed are an array of group_memberships defined by the line `memberships: many(group_memberships)`. The second nested `with` is actually traversing `groupMembershipsRelations` and grabbing the phonemes from there. `group_memberships` are one-to-one with phonemes and groups, so that's the main table we need to look through for relations. Is the `memberships: many(group_memberships)` line enough to know to look at the `groupMembershipsRelations` to understand the connections? That IS the relations that actually specifies the fields and references (which themselves are just a repeat of what is already stated earlier in the schema), so grabbing memberships then just returns a list of `group_memberships` that have the matching group_id, and the second `with` is doing the same thing to get the phonemes with a matching `phoneme_id`. The whole thing seems so abstract. The comprehension issue is coming from the fact that both ends of the relationship are written separately.

### Day 11

**Shipped:** Added the components and actions required for the group manager. A user can now create, delete, and rename phoneme groups as well as assign and remove memberships from phonemes. A lot of the code was lifted from the previous form and adapted to fill this need. Most of it was written by hand and CC was only called at the end to assess code against rules set out in `CLAUDE.md`. This was not done strictly out of need, but to try to assess my own ability to write the code. Results are not perfect, but there is an upwards trend.

**Learned:** I think I can officially say that I _do_ know what I am doing with Tailwind — at least to the same degree that I can say that about standard CSS. There were no major issues with the handwritten code apart from some leftovers from copying and pasting and a failure to adhere to one of the standards at the end. A lack of backend experience means that some aspects of managing forms are not yet intuitive to me. Passing all the ids through form components with the same name prop and passing all the previous members through hidden inputs is not a technique that I had been previously introduced to, but I expect to run into similar situations relatively soon and I now have a new pattern to use for it. This is maybe a time to look again at the checkboxes.

### Day 12

**Shipped:** Began updating API routes to bring them into parity with server actions. Can now request a list of phonemes, as well as create, delete, and edit existing ones. Updated middleware to return a 401 on API routes rather than redirect to the Clerk sign-in page.

**Learned:** API routes are, so far easy to write. The Svc layer handling all the logic there means that I really just need to validate the data that is coming in. Started testing with Postman; I am not great at it, but I did figure out how to hook it up to grab my cookies off of the browser. I noticed that requests would, seemingly randomly return HTML rather than the JSON I was looking for. Calling `auth.protect()` on all routes, including API routes, means that, when the session cookie expires — which seemingly happens fairly quickly, it redirects API requests to the sign-in page. Returning 401 at least makes it clear what happened, but I expect this might cause a problem for future integration and will require some changes to `getOrCreateDbUser()`. Once again though, keeping my stuff separate is paying off. This issue does not affect the main work that I am doing and is just one piece that can be swapped out later on when needed. For now, being able to assess whether the routes _can_ work is all I care about.

### Day 13

**Shipped:** Added HTTP routes for managing groups and group members. Can now request a list of groups (also returns member phonemes), create new groups, delete groups, check the members in a specific group, add members, and remove members. Adding a new Svc function to get all members from a group by ID did initially make me think I should've just done that before for the server actions instead of the whole thing with the hidden inputs. This instinct was, in hindsight, misguided. We do not want to make more trips to the db just to grab something we already have. Also, this was a successful AND valid use of `with`. It was technically just a modified version of the previous one made to just grab one group based on its ID, but the point stands. Most code is derivative to begin with.

**Learned:** The big takeaway from these last two sessions is that API architecture is fundamentally different from frontend design — well, technically server actions are still backend, but the purpose is fundamentally different, so the point stands. API routes are granular and separate and they must handle concerns differently. Updating a group, to a user, is a very different meaning than it does to the API. Having the same function handle membership changes and name updates IS good UX. You do not want to go to a different page or menu to do something so clearly related to what the group is, but emulating that same architecture in the backend would be disregarding the fact that the tables fundamentally do not work like that.

### Day 14

**Shipped:** Added Svc functions for managing syllable structures. Began importing the required data from db in the syllables route and building the skeleton for the syllable list. Most of the code here was harvested from other parts of the project.

**Learned:** There was a substantial Claude outage at the time that I started working, so this was done 100% the slow way. The patterns are effectively the same as the ones for phonemes, but that is all just how CRUD apps work. I did initially feel bad about all the copy-pasting, but, then again, harvesting code from the phoneme Svc layer is not substantially different from repeatedly going back to Stack Overflow to steal that same old Fisher-Yates array shuffling function.

### Day 15

**Shipped:** Implemented form for adding and editing syllable structures. A user can now create and edit syllable templates using sequences of phonemes and/or phoneme groups. The general flow for this page is effectively the same as for the phonemes section. One singular form with an 'Add'/'Edit' mode that just takes a structure and a formAction and a cancel method. The Add Structure button at the top toggles between just being a button and becoming the actual form. The syllable rows have a delete button and an edit button that toggles between the normal row display and the form. However, the rows don't yet display anything other than those buttons and the form itself is quite ugly.

**Learned:** Figuring out how to use z.infer<> to extract the syllable template type was the highlight of my day. The server actions were nothing special. The method that I found for passing the template through a formAction is somewhere between clever and smelly, though. Using a hidden input (knew that would come up again), I pass a JSON string of the template state and then the server action parses it again. It 100% works and stringifying an array and then parsing it is not especially performance-intensive, so that's not a huge concern, but the packaging and unpackaging feels off. I did unfortunately(?) find myself getting tired writing the frontend and had CC make the slot adding bit of the form. It works fine. I tested it. And I am willing to take its current ugliness as the convenience tax. The fact that it didn't need to touch up my Svc and action functions is a good sign. This bit didn't have anything weird like the `groupsWithMembers` bit, but not messing things up is a good sign anyways. I am soon coming up on having to make the actual wordgen logic. I guess that technically goes next since the rules NEED there to be words there already, so the next sequence after I finish touching up this page is wordgen > lexemes page > rules (the _big_ one).

### Day 16

**Shipped:** Prettified the Syllable Structures page and added the template and weight content to the rows. No real new functionality was added here as this was, as stated earlier, paying the convenience tax for having CC finish the form. Fixed a bug where invalid JSON would throw an error in the server action and would bypass the expected `Result`. Double-checked the Svc validation steps to make sure we were properly handling the JSON.

**Learned:** The theme of the day is error handling. This was the first time dealing with uploading JSON to the db, so there's some lessons here. I still don't dislike the method by which it is done. The packaging and repackaging is odd, but the form can only pass it as a string and the Svc can only take it as an object. Handling the possible error JSON.parse might throw is an additional step that I failed to anticipate, but I need to think of it as more validation. It is the same principle as earlier. The actions are exposed, so no value is safe even if it _should_ be internally generated. The schema for syllables was already made with the right JSON shape, so additional validation was not needed there. The single safeParse inside the Svc catches that already, so what matters is that malformed JSON doesn't throw a runtime error beforehand.

### Day 17

**Shipped:** Added syllable structure API routes and fixed wrong return status codes. Began planning out the word generator.

**Learned:** Busy days mean simple work, and simple work means I get a lot of time to think. I grow increasingly frustrated with the look of things. I'm in too deep into this workflow to want to disrupt it by worrying about looks, and doing so would likely become an endless endeavor, but I can already see a good batch of reusable components in the future. That will probably be the bit after the rules page is finished. That's the most complex bit of logic and is the last page that will need to be written. Get it all working, then, once I know what pages I'll have and what layout they'll need, I can start trying to fix it up.

### Day 18

**Shipped:** Began working in the wordgen Svc. The logic for creating usable phoneme lists out of templates is long and uses just about every trick I've learned about querying the db. It also runs multiple queries in parallel through Promise.all — which has not been necessary yet, but two queries that don't rely on each other but are both needed to proceed is the exact use-case for Promise instead of async-await. The generator logic was mostly ported from my old `wordgen.py` script — at least to the degree that it could be translated. There is an uncomfortable amount of RNG scattered around, meaning that testing is a lot harder and the file will need some refactoring to consolidate impurities.

**Learned:** This was a great showcase of the pros and cons of jsonb data. It is a lot easier to work with once you have it, but it genuinely made me reconsider adding a slots table to the db so that I could query it instead. That, however, would be its own kind of inefficient. The fact that the jsonb cannot explicitly reference a FK also meant that I needed to add additional checks and even expand the `Results<T>` definition for the first time to account for conflicts when deleting a phoneme or group that is part of a structure. The whole file also ran into a lot of edge cases. Numbers passed to the Svc would individually cause problems if they failed to conform to specific constraints, so a blanket validation error would be insufficient. We safeParse and then we run individual checks. Word generation can technically run infinite, so an escape hatch with a partial output needed to be made. The actual handling of partial results is deferred to the caller. I almost want to go and edit the json schema for syllable slots to give them individual weight rather than a plain optional setting, but that's the devil talking. No conlanger is that obsessive. That is the bottomless polish well.

### Day 19

**Shipped:** Refactored `wordgen.ts` to be more easily testable. The previous version of the file had exclusively impure functions and repeatedly called `Math.random()`. Rng is now handled by an implementation of Mulberry32 that is passed as an argument to all previously impure functions, leaving the only sources of conflict all confined to the outer shell (db queries, randomizing the seed if none is provided).

**Learned:** Not a lesson from this project, but one that is worth keeping in mind is that functional programming principles are good to follow when dealing with complex logic with edge cases that will need to be tested. Isolating sources of randomness means that I can now write unit tests for the functions here. I have not been writing tests for the rest of the codebase. I do not like writing tests. A lot of what was there previously though is CRUD. There are probably plenty of ways to write integration tests to check that that all works fine, but I do wonder to what degree that's necessary here. I don't have a good eye for identifying where integration tests are needed. But I know for a fact that unit tests are viable and likely necessary for this.

### Day 20

**Shipped:** Began working on the wordgen route. User must be able to select from their templates (must always have at least one) and provide a syllable range (defaults to 1 to 1). Uncertain about any real need to provide number of words to generate or just have a single panel with 10ish words and just let the user refresh the request if they want more (like the Fantasy Name Generator website).

**Learned:** This begins to raise some ideas about the architecture. Rules might need to remember syllable bounds. Lexemes might have different notations given that Phonemes carry both an IPA notation (optional) and a representative symbol (mandatory). The architecture eventually condenses the generated output into words, losing all context. The wordgen page will allow the user to directly bank generated words into the lexicon, so anything output from there already could carry all the required context. The only concern is words that are manually added. I don't yet know how to resolve this dilemma. Easiest compromise between good UX and a robust, workable schema is to disregard syllable bounds past word generation. The app must simply make the assumption that whatever the user is entering by hand is valid and does not need rules applied to it.

### Day 21

**Shipped:** Finished word generation form sans "Add to Dictionary" functionality. A user can now use their language's syllable structures to generate sets of words within a specified syllable range. Updated `generateWordsSvc`'s return to bounce back the requested number of words to check whether the result was partial and added visible error handling to wordgen route.

**Learned:** When first looking at how to manage actions, I saw two methods. One was `useActionState`, which I find weird and clunky (`function.prototype.bind` is kind of cursed), but has ended up being the tool of choice thus far. The other one was `useTransition`, which I did not see a proper use case for until now. Functionally, this is not a form action. This is not something being submitted. I am using stateful values as parameters for an Svc function that are routed through a server action. Functionally, I could have definitely still used the tried and tested method, but it feels semantically wrong here. It also helps that this is a case where it being non-blocking just makes more sense.

### Day 22

**Shipped:** Began work on phonotactics validator Svc function. The checker validates against all syllable templates in a language. This is a visible warning, not a measure to prevent the user from entering invalid words by hand.

**Learned:** There's no simple way of doing this. Multiple templates with optional slots means that syllable shape is very variable. For each optional slot, new templates need to be made when checking and the words need to be checked against all possible templates. This is slow, and therefore needs to happen as infrequently as possible and it needs to not block the UI while running.

### Day 23

**Shipped:** Began working on the dictionary table. Each word in the language gets a row with the term, notes, and tags. The senses (with parts of speech and definitions) get a subtable. No hard limit on senses.

**Learned:** Another join query was used to grab the lexemes with all their additional associated details. Feels like it gets easier every time. It is, however, still not my first instinct. I want to grab everything and merge the data myself. It doesn't help that wordgen had so much of that. Regardless, being able to do it myself based on the existing `relations()` is good.

### Day 24

**Shipped:** Added functionality for importing words from the wordgen into the dictionary. Slight updates to schema.

**Learned:** I initially wanted to force added words to have at least one sense. The problem I found was that this opened up the chance for there to be an error mid-way through taking an action. What happens if a word is added and a sense is not? The solution was to concede the point and just add blank words. Sense schema was updated to allow for empty string fields. The new UI design does mean that senses are added without any text. I am already seeing how this whole page is gonna be a nightmare to manage in the frontend. Again though, the big visual update is deferred to after the rules page is finished.

### Day 25

**Shipped:** Added Svc functionality for editing and deleting lexemes and senses + validation.

**Learned:** Working with the senses presented an interesting new challenge. Lexemes have a language id. Senses have a lexeme id. Normal verification against the languages table does not work here. It needs two checks to first extract all language ids that belong to a user and then all associated lexeme ids. Architecturally kind of ugly and could definitely be solved with some restructuring of the way Svc functions are templated, but functional. The core issue is that the delete functions do not care about the language itself, just that the user is allowed to do the action.

Side Note 1: I need to start adding JSDoc commentary to the arguments in my functions because the Svc functions kept tripping me up on just what they were asking for.

Side Note 2: A lot of Svc function reuse similar bits of code for validation and such. I can and likely should extract those into reusable bits later on. That's the voice in my head that demands endless polish though. Commit to what I'm doing for now and defer to later (when the dictionary route is fully functional).

### Day 26

**Shipped:** Implemented Edit mode, deletion for lexemes, and form for managing sense. A user can now edit and delete lexemes (that they added from the wordgen), as well as add, remove, and update their senses.

**Learned:** More on architecture. The add sense button was previously always visible. This does not match the established conventions across other routes. But the way senses need to be managed separate from the lexeme fields also means that the previous form styles don't do it either. This Edit mode needs individual saves for items and has no cancel button to return to previous state, but it is readable and functional and successfully adheres to previous conventions as much as possible. There are also two delete buttons (one in the Edit form and one in the actions column), which is maybe odd, but I find both positions fitting. Feels like the issues I am running into now have a different, less interesting flavor than before.

### Day 27

**Shipped:** The big Svc refactor. Repeated code was extracted split into two categories: ownership and parsing and was extracted into two new files. Results were extracted into constructors that are not imported from `Results.ts`. Nearly 40 functions across the Svc layer were just using the same bits of code. In all, only a handful of utils were created and the whole Svc layer is far simpler now.

**Learned:** Big changes like this are not especially difficult, but they are time consuming. I had CC work through all that because there were genuinely too many functions to go through and check. I then verified that it all worked before committing it. All tests in wordgen and phonotactics pass successfully and the pages still work as intended. Auditing changes like that is time consuming still, but is far preferable to having to insert all the new utils by hand. I almost feel as though I stepped into the endless polish trap, but I'm choosing to believe otherwise just because the scope of the polish was pre-defined. It is maybe worth analyzing how valid of a metric that is.

### Day 28

**Shipped:** Updated `CLAUDE.md` to comply with latest changes to project structure. Added conflict Result type and Svc layer helpers. Created skill for adding new slices to the app following the established pattern of Svc > actions > route > page. Added skill for assessing changes to the code (including testing, which was not included in original `CLAUDE.md`).

Updated API routes to bring parity to the dictionary route.

**Learned:** It's easy to rely on old tools and forget to bring them up to date after a refactor. Certainly, it was not something that had occurred to me back when I first altered the Result type. It is good though to remember to keep up with it. The skill to verify needs the structure to be clearly stated, so at least that forces me to think about major changes to the project before following through.

As for the updates to the API route, the only big question was wordgen banking. There is no way for me to guarantee from here that a new word going through that route IS from the wordgen, so that all falls to future implementation. I myself cannot enforce it from here, but whatever future project that DOES implement that API needs to be able to bank wordgen lexemes anyways. Does not feel good to have less control of my inputs, but I don't see any real alternatives.

### Day 29

**Shipped:** Added helper to the API routes to assist with error handling and Response management. In the same vein as the last refactor, I had some 16-ish routes all essentially implementing the same code to do the same thing. A big part of it was literally just assigning the right return code to the Response. Updated the `CLAUDE.md` and `SKILL.md` files to recognize this new pattern.

**Learned:** Days with little time are days when the only thing I feel I can do is small improvements. For what it's worth though, this did catch a couple of bugs where the wrong return codes were being used, so it _did_ accomplish something. It does pay off for the future because this bug is now one that cannot occur again because Response handling all goes through the same pipeline. It is not especially different from the logic behind the service layer; one layer of abstraction that everything goes through guaranteeing equal implementation.

### Day 30

**Shipped:** Began working on searching and filtering functionality for the dictionary route. A user can now use search features to find a lexeme by term, senses, notes, or tags, and can sort them in alphabetical or reverse alphabetical order.

**Learned:** The big decision point here is whether to do it through component state or URL params. The choice I went with was state. It is easier to code, but is not repeatable/sharable in the same manner. However, those features, as nice as they sound, don't actually pay off with the current architecture. A user cannot share a link to a search because languages are locked to a user. An app in which that feature pays off is one where a language can be shared. It's not impossible to have that as a feature in the future and I am liable to go and implement URL params later anyways, but this was the path that made the most sense at the time.

### Day 31

**Shipped:** Set up test Clerk account for verifying features and amended verify `SKILL` and local `env` to account for it.

Registered Microsoft's official Playwright MCP server at the user level.

Added loading.tsx to dictionary route.

**Learned:** Apparently, Clerk just lets you set up a dummy account by adding +clerk_test to the root of the email address. No email verification required. Code is always 424242. Great for automated sign-in. I also looked into how the session cookies worked and I see that testing with Postman will always be mildly annoying, but future API implementations are actually safe. The key difference that I failed to fully grasp earlier was that the 7-day session lives on Clerk's end and the 60-second `__session` (what the app verifies) is a JWT. `clerk.js` refreshes every 50 seconds, so this is completely seamless from the app. Postman, however, takes longer to refresh snapshots. A hypothetical mobile app that implemented the API would have access to the SDK's `getToken()` which handles that same dance on its own.

The fix for Postman is making a longer-lived JWT template and then using `await window.Clerk.session.getToken({ template: 'postman' })`, which is slightly more effort than spam-clicking the button until the snapshot syncs back up with the current `__session`.

### Day 32

**Shipped:** Initial implementation of the tag system. A lot of it mimics the phoneme groups setup (mainly the specific implementation of the relations table). A user can now, within the dictionary route, add, edit, and remove tags from their language and, within the lexemes table, attach and detach said tags to lexemes.

Fixed a bug where unique validations would be universally ignored.

**Learned:** `isUniqueViolation` in `app/lib/ownership.ts` checked for a code property directly on the caught error, but `drizzle-orm 0.45.2` wraps driver errors in `DrizzleQueryError` with the actual Postgres error nested in `.cause`. This meant unique-violation catches, including the pre-existing ones in `phoneme-groups.ts`, never matched and instead threw uncaught 500s.

### Day 33

**Shipped:** Began work on the Rules system. Updated the validation, added a Relations table for Rules, wrote the Svc layer, and added API routes for testing.

**Learned:** API routes are not necessary right now, but they're much cheaper to play around with than a full frontend, so I keep finding myself wanting to make them. As for the actual matter of what went into the Svc layer, the closest analogue to Rules are the Syllable Structures. The dependency on phonemes and phoneme groups WHILE the keys are stored in JSON (so verifying authenticity is an extra step) is the hallmark feature. I made a couple of helpers to deal with that and I'm just straight up using SQL. I'm not great at it, but complex calls feel like they require broader tools. It might be worth giving a second look at how that was handled in the past since I suspect the newer implementation might just be better. The current plan for organizing Rules is an up/down button setup that just shifts a rule by one space. That too needed its own specialized SQL to swap the positions of two rules.

### Day 34

**Shipped:** Added the Rules page and server actions and loading.tsx and helpers for writing out a Rule in plain text. A user can now create custom rules within their language that target a phoneme or group and mutate it into a different phoneme based on the surrounding context.

_Note:_ Does not hook up to wordgen yet, so the rules don't actually do anything.

**Learned:** No new challenges here, but this was the last bit of UI / CRUD work that was planned for the app. The next step, hooking it up to the wordgen (and updating the unit tests) is the second big instance of real logic that'll happen in the app. I've been using Playwright and the test account for verification (integrated into the verify SKILL) and I can safely say it has improved the overall workflow as it means that I can have my own testing on my own account with my own sample language and have CC run its own testing in addition.

### Day 35

**Shipped:** Began prep for hooking up rules to wordgen. This first part is a rework of the wordgen script itself to ready it for implementation.

**Learned:** The wordgen script de-tokenized phonemes and groups before assembling individual syllables. The rules carry only tokens and need to apply after a word is completed. This was, looking back, a failure on my part. Data should have been preserved until a new shape was needed. Today's rework is about carrying the tokens further. The output is the same, but the processing itself does not care about the symbols. The user sees no change from this change, but it means that applying rules won't require another level of conversion.

### Day 36

**Shipped:** Finished hooking up rules system to wordgen. Added tests for applying rules and for writing the actual plain text rule notation.

**Learned:** `applyRules()` takes a `WordToken[]`, iterates through the rules to find matches, and then blanket applies rule changes. The only real caveat here is that it does not re-iterate on itself. Changes are applied once and then we move on to the rule on the next position, so it is non-recursive. This might be worth changing in the future or at least documenting such that the user is aware of how the system works. It's not necessarily a bad design, the issue is being able to convey it.

### Day 37

**Shipped:** Populated the overview page `app/languages/[id]/page` with stat cards (previously just a placeholder with the language id), updated the landing/root page `app/page` with a very simple overview of what the app is for, and made new sign-in/sign-up routes `app/(auth)/sign-up/[[...sign-up]]/page.tsx` & `app/(auth)/sign-in/[[...sign-in]]/page.tsx` rather than just using Clerk's built in page. The auth routes are still rather bare, but that's a different step.

**Learned:** Not much to be done in regards to new technologies. Only real advancements are Next.js folder names. Groups are made with `(group)` and optional catch-all segments are made with `[[...segment]]`. The big thing that came through here is my own lack of pre-planning. The overview is a deeply frustrating page because the db does not care about when any given change was made. As a stat, it does not help much at all with actually managing the core components of the language (beyond maybe being a sorting option for the dictionary), but an overview page really does want something like that to track latest changes.

### Day 38

**Shipped:** Blanket added timestamps to tables and updated overview route with recently added lexemes. Added sorting by creation and update dates to the dictionary route. Also added tests for relative-time (needed for Overview).

**Learned:** Another simple push. The timestamps default to the current time, so not much that could break and no real impact on the Svc layer. Looking back though, this feels like something I should have had to begin with and I am lucky that adding it here did not create any real issues. For future reference, it might be good to keep in mind that dates are a low cost feature that can significantly pay off in the future. I also think I have done a reasonable job at maintaining tests here. A lot of the app is just CRUD, but I think I've gotten better at identifying the actual logic as I write it and building tests for it. Could be worth a big pass at the app to see what I may have missed earlier, though.

Next up: ~~Hell~~ The Big UI Update.

### Day 39

**Shipped:** The big UI update. Overhauled the previous palette, added and set up shadcn/ui and all the bits that came with it, created basic, reusable UI components, and populated the app with them.

**Learned:** The whole thing was actually a whole lot less dreadful than expected mostly because of automation allowing me to go and push changes across the whole codebase. Realistically though, I am filing that as another thing that SHOULD have been in the pre-planning stage and I got lucky enough for it to not become a massive issue.

As for the actual way it functions, I feel like I am once again in a position where I'm playing with a black box. Regardless, I can see that `cva` is used to set up variant style templates that are then composed in the exported component function. I can see that it works, but I would do well to read more on it to ensure I have a proper understanding of HOW I'd write it beyond the clear template I am seeing here.

### Day 40

**Shipped:** Ran a full v1.0 shipping checklist through CC, reviewing and confirming along the way rather than writing by hand. Retired `db:push` in favor of committed Drizzle migrations, generated a baseline migration off the current schema, marked it applied by hand-inserting its hash into `drizzle.__drizzle_migrations` (drizzle-kit has no real baseline command), and took a Neon branch snapshot first as the actual rollback point. Added CI (GitHub Actions: lint, typecheck, test on every push/PR) and a standalone `typecheck` script. Fixed pre-existing type errors in tests that the new typecheck script exposed. Added screenshots to the README. Added `error.tsx`/`not-found.tsx` boundaries that for some reason never existed. Renamed the repo/package to conlang-studio, bumped to 1.0.0, tagged and pushed the v1.0.0 release.

**Learned:** _The big one:_ `next build`'s TypeScript pass only checks files reachable from routes/pages, not the whole project — despite `tsconfig.json`'s include covering every `.ts`/`.tsx` file and `strict: true` being on. Two test files had type errors (mock rows missing `created_at`/`updated_at`). Only `tsc --noEmit` actually caught them. Why is it like that?

Also, drizzle-kit has no built-in way to baseline an existing db against a fresh migration. What it expects is just a `hash`+`created_at` row in `drizzle.__drizzle_migrations` matching the migration file. And Neon's actual point-in-time recovery window on this plan is only 6 hours, so the branch snapshot was the only real rollback path.

This was my first time publishing an app, so I did find myself relying on CC a lot more to know what all needed doing. I had my own checklist, but it is good to have something to run it against and it is good to have something that can handle the task itself while I just guide and verify.

## Retrospective

There's a lot that I learned here. It was my first big excursion into a project with real backend and I think it went well. Beyond the actual tools that I had to learn, there's the matter of architecture—the app structure and the db schema were aspects that I was always having to think about and work with. Two things that I noted several times throughout my notes were the endless polish trap and the failure to pre-plan. Endless polish is self-explanatory; the goal was to develop v1.0.0—a fully-deployed, feature-complete application—and that goal is not achievable if I keep going back and perfecting forever. I recall when I first was learning to code I had the thought that the ideal program was one that did just one thing and did that thing as well as possible. Back then it was about console scripts, now it was a full-stack web application. The failure to pre-plan is a different thing altogether. I cannot, in good faith, say that I should have seen it all coming; it was my first time working at this scale and I came in with very little. What I can say is that every time that failure is noted is something to look back on next time and think through how it could have improved. Is the app perfect? No. I will likely come back to improve it later. Plenty of threads still loose and plenty of updates that were deferred, but that's beyond v1.0.0. After 40 consecutive days of working on it, I think I'm good to let it sit for a second.

### Day 41

**Shipped:** Let it sit for a second. Then, the day after publishing that retrospective, pushed four commits: empty-state hints pointing users from phonemes toward groups/structures/rules, a landing page update, a languages list update, and an input alignment fix on the wordgen form.

**Learned:** "Let it sit" apparently has a misserably short shelf life. In fairness to past me, these were all cosmetic. Nno schema changes, no new Svc functions, nothing that reopens the endless-polish trap I actually warned myself about. The trap was scope creep on features and architecture, not "noticed a paragraph of empty-state copy was unhelpful and fixed it in ten minutes." I expect more of these while the next large-ish update gets planned out. **TODO: Figure out how version numbers actually work because I am not entirely sure what counts as v1.0.1 vs v1.1.0**

### Day 42

**Shipped:** A public, read-only demo language. A recruiter or a random visitor hits the Clerk wall before seeing a single page of the app, and that's a bad first impression. Added `is_public` to `languages` (proper migration this time, not a push), a new `requireVisibleLanguage`/`parseAndRequireVisibleLanguage` pair in `app/lib/ownership.ts` next to the existing helpers, widened the six read Svc functions (plus `generateWordSvc`) to take `user: DbUser | null`, and reworked all six language subpages to resolve visibility instead of bouncing straight to sign-in. Every mutation control across all seven client components now takes a `canEdit` prop and just doesn't render for a non-owner. Widened `proxy.ts`'s public matcher so anonymous requests can actually reach those pages. In all, it touched twenty-ish files. Verified it with Playwright driving both a signed-in owner session and a signed-out incognito context against a language I flipped `is_public` on directly through Neon.

**Learned:** This one's less about a new tool and more about a design choice. My first instinct was a `readOnly` flag on the resolved user. Simple, works for exactly one hardcoded demo account. The problem is it doesn't generalize. I eventually want to add real collaboration, and a flag on the user can't express that. It can only express "this whole user session is read-only," which is far too narrow. `is_public` on the language row is barely more work today and is the right shape for the future when sharing shows up, `is_public` just becomes the "anyone" case next to a future grants table, instead of being ripped out.

Also, settled on the specific semantic versioning rules to follow:

- PATCH: Copy/UI/bug fixes, no schema change, no new Svc functions
- MINOR: New features/capabilities added additively. New columns/tables, new Svc functions or routes, widened existing behavior (like today's DbUser | null) that doesn't change how existing callers work
- MAJOR: Anything that breaks existing data or existing usage. Non-additive migrations (renames/drops, backfills that lose info), or a fundamental rework of a core model

### Day 43

**Shipped** Added `Playwright/test` to the project and set up a simple e2e test setup to be used along the verify SKILL. The specific tools that I have access to mean that this could not be implemented into CI, so it needs to happen before pushing anything new.

**Learned** The latest refactor with the demo language showed me that leaving e2e testing to CC's discretion is grossly inefficient. Having to derive basic tests every time is time consuming and token consuming and is every kind of inefficient. The setup I am working with is the main limiting factor. There is no test database. There are no secrets in the CI (and adding them would probably be a big change to how security is handled here). There is exactly one test account. There are no instances of `data-testid` throughout the app because this was not a prior consideration (though that could and likely will change in a future pass).
