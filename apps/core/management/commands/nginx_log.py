"""
Logs reader for Nginx

TODO

- [ ] Read and extract to use in app
- [ ] Clean logs
- [ ] Production Nginx might serving multply apps, so reading and cleaning should perform just what is required.

"""
import re
import gzip
import os
import time
import csv
import json
from urllib.parse import urlparse, parse_qsl

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

class LogParser:
    """
    Reads and parses NGINX logs based on the provided configuration.
    This class is adapted from your original log.py script.
    """
    def __init__(self, app_id, task_type, nginx_log_dir, output_dir):
        self.app_id = app_id
        self.task_type = task_type
        self.log_dir_nginx = nginx_log_dir
        self.log_dir_media = output_dir

        # File naming and formats
        self.NOTEFile_path = os.path.join(self.log_dir_media, f"{self.app_id}.{self.task_type}.log")
        self.CSVFile_path = os.path.join(self.log_dir_media, f"{self.app_id}.{self.task_type}.csv")
        self.CSVDictionary = {}
        self.NOTEDatatime = 0
        self.NOTEFormat = {'id': 0, 'item': 0, 'count': 0, 'total': 0, 'sum': 0, 'new': 0}

        # CSV Configuration
        self.CSVDelimiter = ','
        self.CSVQuoteChar = '"'
        self.CSVQuoting = csv.QUOTE_MINIMAL
        self.CSVLineTerminator = '\n'

    def get_log_format_regex(self):
        """Returns the compiled regex for a standard NGINX log format."""
        return re.compile(
            r"""(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) - - \[(?P<datetime>\d{2}\/[a-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} (\+|\-)\d{4})\] ((\"(GET|POST) )(?P<url>.+)(http\/[1-2]\.[0-9]")) (?P<statuscode>\d{3}) (?P<bytessent>\d+) (?P<refferer>-|"([^"]+)") (["](?P<useragent>[^"]+)["])""",
            re.IGNORECASE
        )

    def find_log_files_to_parse(self):
        """Reads logs directory for .gz files modified after the last run."""
        files_to_parse = []
        if not os.path.isdir(self.log_dir_nginx):
            return files_to_parse
        
        app_id_str = f".{self.app_id}."
        for filename in os.listdir(self.log_dir_nginx):
            if filename.endswith(".gz") and app_id_str in filename:
                filepath = os.path.join(self.log_dir_nginx, filename)
                modified_time = os.stat(filepath).st_mtime
                if modified_time > self.NOTEDatatime:
                    files_to_parse.append(filename)
        return files_to_parse

    def load_dictionary_from_csv(self):
        """Reads word/visit data from CSV into a dictionary."""
        if not os.path.isfile(self.CSVFile_path):
            return
        
        with open(self.CSVFile_path, 'r', encoding='utf-8') as fs:
            reader = self.csv_reader(fs)
            for item, count in reader:
                if item in self.CSVDictionary:
                    self.CSVDictionary[item] += int(count)
                else:
                    self.CSVDictionary[item] = int(count)

    def read_last_run_time(self):
        """Reads the timestamp from the last run from the .log note file."""
        if not os.path.isfile(self.NOTEFile_path):
            return
            
        with open(self.NOTEFile_path, 'r', encoding='utf-8') as fs:
            reader = self.csv_reader(fs)
            try:
                self.NOTEDatatime = int(next(reader)[0])
            except (StopIteration, IndexError, ValueError):
                self.NOTEDatatime = 0 # Reset if file is empty or corrupt

    def write_last_run_time(self):
        """Writes the current timestamp to the .log note file."""
        with open(self.NOTEFile_path, 'w', encoding='utf-8') as fs:
            writer = self.csv_writer(fs)
            self.NOTEFormat['id'] = int(time.time())
            writer.writerow(self.NOTEFormat.values())

    def write_dictionary_to_csv(self):
        """Erases the old CSV and writes the updated dictionary, sorted."""
        # Determine the sorting order based on task type
        if self.task_type == 'visit':
            # Sort by count, descending
            ordered_items = sorted(self.CSVDictionary.items(), key=lambda x: x[1], reverse=True)
        else:
            # Sort alphabetically by item
            ordered_items = sorted(self.CSVDictionary.items())

        with open(self.CSVFile_path, 'w', encoding='utf-8') as fs:
            writer = self.csv_writer(fs)
            for item in ordered_items:
                writer.writerow(item)
    
    def csv_reader(self, file_handle):
        """CSV reader with custom config."""
        return csv.reader(file_handle, delimiter=self.CSVDelimiter, quotechar=self.CSVQuoteChar)

    def csv_writer(self, file_handle):
        """CSV writer with custom config."""
        return csv.writer(file_handle, delimiter=self.CSVDelimiter, quotechar=self.CSVQuoteChar, quoting=self.CSVQuoting, lineterminator=self.CSVLineTerminator)

    def open_log_file(self, filename):
        """Opens a log file, handling .gz compression."""
        filepath = os.path.join(self.log_dir_nginx, filename)
        if filename.endswith(".gz"):
            return gzip.open(filepath, 'rt', encoding='utf-8')
        else:
            return open(filepath, 'r', encoding='utf-8')

    def parse_log_file(self, filename):
        """Reads a single log file and populates the dictionary."""
        log_format_regex = self.get_log_format_regex()
        
        # Determine which filter to use based on task type
        filter_method = self.word_filter if self.task_type == 'word' else self.visit_filter

        with self.open_log_file(filename) as fs:
            for line in fs:
                match = re.search(log_format_regex, line)
                if match:
                    datadict = match.groupdict()
                    key = filter_method(datadict)
                    if key:
                        if key in self.CSVDictionary:
                            self.CSVDictionary[key] += 1
                        else:
                            self.CSVDictionary[key] = 1
                            self.NOTEFormat['new'] += 1

    @staticmethod
    def word_filter(datadict):
        """Extracts a search word from a URL query string."""
        url = urlparse(datadict["url"])
        if url.path == "/definition" and url.query:
            query_params = dict(parse_qsl(url.query))
            if 'q' in query_params:
                word = query_params['q'].strip().lower()
                if word.replace(' ', '').isalnum() and not word.isdigit() and word.isascii():
                    return word
        return None

    @staticmethod
    def visit_filter(datadict):
        """Extracts the visitor's IP address."""
        return datadict["ip"].strip()


class Command(BaseCommand):
    help = 'Parses NGINX access logs for a specific app ID and aggregates word search or visit data.'

    def add_arguments(self, parser):
        parser.add_argument('app_id', type=str, help='The application ID to filter logs for.')
        parser.add_argument(
            '--type',
            type=str,
            choices=['word', 'visit'],
            default='word',
            help='The type of data to parse: "word" for search terms or "visit" for IP addresses.'
        )

    def handle(self, *args, **options):
        app_id = options['app_id']
        task_type = options['type']

        # --- Get configuration from settings.py ---
        try:
            nginx_log_dir = settings.NGINX_LOG_DIR
            output_dir = settings.PARSED_LOG_OUTPUT_DIR
        except AttributeError as e:
            raise CommandError(
                f"{e} is not defined in your settings.py. Please add NGINX_LOG_DIR and PARSED_LOG_OUTPUT_DIR."
            )

        self.stdout.write(f"Starting log parsing for app '{app_id}' (type: {task_type})...")

        # --- Instantiate and run the parser ---
        parser = LogParser(app_id, task_type, nginx_log_dir, output_dir)
        
        self.stdout.write("Reading last run timestamp...")
        parser.read_last_run_time()

        self.stdout.write("Loading existing CSV data into dictionary...")
        parser.load_dictionary_from_csv()

        self.stdout.write("Finding new log files to process...")
        files_to_parse = parser.find_log_files_to_parse()

        if not files_to_parse:
            self.stdout.write(self.style.SUCCESS("No new log files to parse. Task complete."))
            return

        self.stdout.write(f"Found {len(files_to_parse)} new log file(s):")
        for f in files_to_parse:
            self.stdout.write(f"  - Parsing {f}...")
            parser.parse_log_file(f)

        self.stdout.write("Writing updated data to CSV file...")
        parser.write_dictionary_to_csv()

        self.stdout.write("Updating last run timestamp...")
        parser.write_last_run_time()
        
        self.stdout.write(self.style.SUCCESS("Log parsing finished successfully!"))
