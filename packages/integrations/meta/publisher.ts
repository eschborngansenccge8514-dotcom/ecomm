import { MetaClient } from './client';

export class MetaPublisher extends MetaClient {
  constructor(
    accessToken: string,
    private readonly igUserId?: string,
    private readonly fbPageId?: string,
  ) {
    super(accessToken);
  }

  // Instagram Content Publishing API (Two-step publish)
  async createIgMediaContainer(params: {
    imageUrl: string;
    caption: string;
  }): Promise<string> {
    if (!this.igUserId) throw new Error('Instagram User ID is required');

    const data = await this.fetch<{ id: string }>(`${this.igUserId}/media`, {
      method: 'POST',
      json: {
        image_url: params.imageUrl,
        caption:   params.caption,
      },
    });
    return data.id;
  }

  async publishIgMedia(containerId: string): Promise<string> {
    if (!this.igUserId) throw new Error('Instagram User ID is required');

    const data = await this.fetch<{ id: string }>(`${this.igUserId}/media_publish`, {
      method: 'POST',
      json: {
        creation_id: containerId,
      },
    });
    return data.id;
  }

  async publishIgCarousel(params: {
    imageUrls: string[];
    caption: string;
  }): Promise<string> {
    if (!this.igUserId) throw new Error('Instagram User ID is required');

    // Step 1: Create child containers for each image
    const childIds = await Promise.all(
      params.imageUrls.map((url) =>
        this.createIgMediaContainer({ imageUrl: url, caption: '' })
      )
    );

    // Step 2: Create carousel container
    const data = await this.fetch<{ id: string }>(`${this.igUserId}/media`, {
      method: 'POST',
      json: {
        media_type: 'CAROUSEL',
        children:   childIds,
        caption:    params.caption,
      },
    });

    // Step 3: Publish carousel container
    return this.publishIgMedia(data.id);
  }

  // Facebook Pages API
  async postToFbPage(params: {
    message: string;
    imageUrl?: string;
  }): Promise<string> {
    if (!this.fbPageId) throw new Error('Facebook Page ID is required');

    const endpoint = params.imageUrl ? 'photos' : 'feed';
    const json: Record<string, any> = {
      message: params.message,
    };
    if (params.imageUrl) json.url = params.imageUrl;

    const data = await this.fetch<{ id: string }>(`${this.fbPageId}/${endpoint}`, {
      method: 'POST',
      json,
    });
    return data.id;
  }
}
