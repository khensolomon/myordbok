import random
from django.core.management.base import BaseCommand
from faker import Faker
from core.models import Post
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Creates a specified number of demo posts'

    def add_arguments(self, parser):
        # This allows you to specify the number of posts to create
        # e.g., python manage.py create_demo_posts --number 50
        parser.add_argument('--number', type=int, help='The number of demo posts to create', default=10)

    def handle(self, *args, **options):
        # Initialize the Faker library
        fake = Faker()
        number_of_posts = options['number']

        # Get the first user to be the author, or create one if none exist
        # In a real project, you might want to select a user more carefully
        author, created = User.objects.get_or_create(username='demouser')
        if created:
            author.set_password('password')
            author.save()
            self.stdout.write(self.style.SUCCESS('Created a demo user "demouser"'))

        self.stdout.write(f'Creating {number_of_posts} demo posts...')

        # Loop to create the specified number of posts
        for _ in range(number_of_posts):
            Post.objects.create(
                title=fake.sentence(nb_words=6),
                content='\n'.join(fake.paragraphs(nb=5)),
                author=author
            )

        self.stdout.write(self.style.SUCCESS(f'Successfully created {number_of_posts} demo posts!'))

