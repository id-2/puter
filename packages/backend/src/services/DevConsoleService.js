/*
 * Copyright (C) 2024 Puter Technologies Inc.
 *
 * This file is part of Puter.
 *
 * Puter is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
const { consoleLogManager } = require('../util/consolelog');
const BaseService = require('./BaseService');

class DevConsoleService extends BaseService {
    _construct () {
        this.static_lines = [];
        this.widgets = [];
        this.identifiers = {};
    }

    turn_on_the_warning_lights () {
        this.add_widget(() => {
            return `\x1B[31;1m\x1B[5m *** ${
                Array(3).fill('WARNING').join(' ** ')
            } ***\x1B[0m`;
        });
    }

    add_widget (outputter, opt_id) {
        this.widgets.push(outputter);
        if ( opt_id ) {
            this.identifiers[opt_id] = outputter;
        }
    }

    remove_widget (id_or_outputter) {
        if ( typeof id_or_outputter === 'string' ) {
            id_or_outputter = this.identifiers[id_or_outputter];
        }
        this.widgets = this.widgets.filter(w => w !== id_or_outputter);
    }

    update_ () {
        this.static_lines = [];
        // if a widget throws an error we MUST remove it;
        // it's probably a stack overflow because it's printing.
        const to_remove = [];
        for ( const w of this.widgets ) {
            let output; try {
                output = w();
            } catch ( e ) {
                consoleLogManager.log_raw('error', e);
                to_remove.push(w);
                continue;
            }
            output = Array.isArray(output) ? output : [output];
            this.static_lines.push(...output);
        }
        for ( const w of to_remove ) {
            this.remove_widget(w);
        }
    }

    async _init () {
        const services = this.services;
        // await services.ready;
        const commands = services.get('commands');

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'puter> ',
            terminal: true,
        });
        rl.on('line', async (input) => {
            this._before_cmd();
            if ( input.startsWith('ev') ) {
                eval(input.slice(3));
            } else {
                await commands.executeRawCommand(input, console);
            }
            this._after_cmd();
            // rl.prompt();
        });

        this._before_cmd = () => {
            rl.pause();
            rl.output.write('\x1b[1A\r');
            rl.output.write('\x1b[2K\r');
            console.log(
                `\x1B[33m` +
                this.generateSeparator(`[ Command Output ]`) +
                `\x1B[0m`
            );
        }

        this._after_cmd = () => {
            console.log(
                `\x1B[33m` +
                this.generateEnd() +
                `\x1B[0m`
            );
        }

        this._pre_write = () => {
            rl.pause();
            process.stdout.write('\x1b[0m');
            rl.output.write('\x1b[2K\r');
            for (let i = 0; i < this.static_lines.length + 1; i++) {
                process.stdout.write('\x1b[1A'); // Move cursor up one line
                process.stdout.write('\x1b[2K'); // Clear the line
            }
        }

        this._post_write = () => {
            this.update_();
            // Draw separator bar
            process.stdout.write(
                `\x1B[36m` +
                this.generateSeparator() +
                `\x1B[0m\n`
            );

            // Redraw the static lines
            this.static_lines.forEach(line => {
                process.stdout.write(line + '\n');
            });
            process.stdout.write('\x1b[48;5;234m');
            rl.resume();
            rl._refreshLine();
            process.stdout.write('\x1b[48;5;237m');
        };

        this._redraw = () => {
            this._pre_write();
            this._post_write();
        };

        setInterval(() => {
            this._redraw();
        }, 2000);

        consoleLogManager.decorate_all(({ replace }, ...args) => {
            this._pre_write();
        });
        consoleLogManager.post_all(() => {
            this._post_write();
        })
        // logService.loggers.unshift({
        //     onLogMessage: () => {
        //         rl.pause();
        //         rl.output.write('\x1b[2K\r');
        //     }
        // });
        // logService.loggers.push({
        //     onLogMessage: () => {
        //         rl.resume();
        //         rl._refreshLine();
        //     }
        // });

        // This prevents the promptline background from staying
        // when Ctrl+C is used to terminate the server
        rl.on('SIGINT', () => {
            process.stdout.write(`\x1b[0m\r`);
            process.exit(0);
        });
    }

    generateSeparator(text) {
        text = text || '[ Dev Console ]';
        const totalWidth = process.stdout.columns;
        const paddingSize = (totalWidth - text.length) / 2;

        // Construct the separator
        return '═'.repeat(Math.floor(paddingSize)) + text + '═'.repeat(Math.ceil(paddingSize));
    }

    generateEnd(text) {
        text = text || '';
        const totalWidth = process.stdout.columns;
        const paddingSize = (totalWidth - text.length) / 2;

        // Construct the separator
        return '─'.repeat(Math.floor(paddingSize)) + text + '─'.repeat(Math.ceil(paddingSize));
    }
}

module.exports = {
    DevConsoleService
};
