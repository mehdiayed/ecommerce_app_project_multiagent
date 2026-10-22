namespace ECommerce.Web.Services;

public static class ProductFilter
{
    public static IReadOnlyList<ProductDto> Filter(IEnumerable<ProductDto> products, string? term)
    {
        var t = term?.Trim();
        if (string.IsNullOrEmpty(t))
        {
            return products.ToList();
        }

        return products
            .Where(p => (p.Name?.Contains(t, StringComparison.OrdinalIgnoreCase) ?? false)
                     || (p.Description?.Contains(t, StringComparison.OrdinalIgnoreCase) ?? false))
            .ToList();
    }
}
